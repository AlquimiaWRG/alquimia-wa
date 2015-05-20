<?php
/**
 * @package   alquimia
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 *
 * A utility class that adds the ability of handling slug to WP_JSON_CustomPostType
 * and optionally include Advanced Custom Fields fields into a "fields" property of
 * every post.
 * 
 * This class handles translations with Polylang. If a "filter[lang]" parameter is
 * included into the HTTP request and the requested post is not in the right language,
 * the right translation is returned automatically.
 */
class Q_JSON_CustomPostType extends Q_JSON_SluggedCustomPostType {
  /**
   * The API endpoint URL, starting from /wp-json.
   * @var string
   */
  protected $base = '/posts';
  /**
   * The post type this endpoint should manage.
   * @var string
   */
  protected $type = 'post';
  /**
   * An array of the ACF fields' slugs that should be included with
   * every returned post.
   * @var array
   */
  protected $fields = array();

  /**
   * An array of custom post statuses from the post type. This is set
   * by the Alquimia class.
   * IMPORTANT: do NOT initialize it. This will assume a value one time
   * only, and this must happen when the Alquimia class initializes it.
   * @var array
   */
  protected $post_statuses;

  /**
   * If set to true, allows the using of custom post statuses. This is
   * set by the Alquimia class.
   * IMPORTANT: do NOT initialize it. This will assume a value one time
   * only, and this must happen when the Alquimia class initializes it.
   * @var boolean
   */
  private $allow_custom_post_statuses;

  public function get_type() {
    return $this->type;
  }

  /**
   * Initializes $post_statuses. Works only when it is NULL, so it will
   * work one time only, when called by the Alquimia class.
   * @param array $post_statuses The custom post statuses, from the Alquimia
   * class.
   */
  public function set_post_statuses( $post_statuses ) {
    if ( null === $this->post_statuses ) {
      $this->post_statuses = $post_statuses;
    }
  }

  /**
   * Initializes $allow_custom_post_statuses and adds the needed filters to
   * WP REST API. Works only when it is NULL, so it will work one time only,
   * when called by the Alquimia class.
   * @param boolean $allow_custom_post_statuses Whether or not to allow
   * custom post statuses.
   */
  public function allow_custom_post_statuses( $allow_custom_post_statuses ) {
    if ( null === $this->allow_custom_post_statuses ) {
      $this->allow_custom_post_statuses = $allow_custom_post_statuses;
      add_filter( 'query_vars', array( $this, 'add_post_status_to_valid_query_vars' ) );
      add_filter( 'json_query_var-post_status', array( $this, 'filter_post_status' ) );
      add_filter( 'json_check_post_read_permission', array( $this, 'allow_post_with_custom_status_reading' ), 10, 2 );
    }
  }

  public function register_routes( $routes ) {
    return array_merge( array(
      $this->base . '/(?P<slug>[a-z0-9\-]+)' => array(
        array( array( $this, 'get_post' ),    WP_JSON_Server::READABLE ),
        array( array( $this, 'edit_post' ),   WP_JSON_Server::EDITABLE | WP_JSON_Server::ACCEPT_JSON ),
        array( array( $this, 'delete_post' ), WP_JSON_Server::DELETABLE ),
      )
    ), parent::register_routes( $routes ) );
  }

  public function get_post( $slug, $context = 'view', $filter = array() ) {
    /* Use is_numeric for distinguishing post IDs from post slugs */
    if ( is_numeric( $slug ) ) return parent::get_post( $slug, $context );

    $post_id = $this->get_post_id( $slug );

    /*
    If we have Polylang installed and a "lang" parameter into our $filters, return the "lang"
    translation of the required post.
     */
    if ( defined( 'POLYLANG_VERSION' ) ) {
      if ( ! empty( $filter['lang'] ) ) {
        $lang = $filter['lang'];
        $post_id = pll_get_post( $post_id, $lang );
      }
    }

    if ( is_wp_error( $post_id ) ) return $post_id;
    return parent::get_post( $post_id, $context );
  }

  public function edit_post( $slug, $data, $_headers = array() ) {
    /* Use is_numeric for distinguishing post IDs from post slugs */
    if ( is_numeric( $slug ) ) return parent::edit_post( $slug, $data, $_headers );

    $post_id = $this->get_post_id( $slug );
    if ( is_wp_error( $post_id ) ) return $post_id;
    return parent::edit_post( $post_id, $data, $_headers );
  }

  public function delete_post( $slug, $force = false ) {
    /* Use is_numeric for distinguishing post IDs from post slugs */
    if ( is_numeric( $slug ) ) return parent::delete_post( $slug, $force );

    $post_id = $this->get_post_id( $slug );
    if ( is_wp_error( $post_id ) ) return $post_id;
    return parent::delete_post( $post_id, $force );
  }

  /**
   * Adds post_status to the WP_JSON_Posts valid query vars, so it can return
   * posts with our custom post statuses.
   * @param array $query_vars The query vars from WP_JSON_Posts
   */
  public function add_post_status_to_valid_query_vars( $query_vars ) {
    /* Do not add post_status twice */
    if ( $this->allow_custom_post_statuses && ! in_array( 'post_status', $query_vars ) ) {
      $query_vars[] = 'post_status';
    }

    return $query_vars;
  }

  /**
   * Called when a post status is found into a WP_Query by the WP_JSON_Posts class.
   * @param  mixed $post_status A custom status string or a custom statuses array.
   * @return array              An array of valid post statuses.
   */
  public function filter_post_status( $post_status ) {
    /*
    This should be executed only when custom post statuses are allowed by this very class,
    but we double check anyway. If we didn't allow custom custom post statuses, just don't
    filter.
     */
    if ( $this->allow_custom_post_statuses ) {
      /* Normalize the argument to an array */
      if ( ! is_array( $post_status ) ) $post_status = array( $post_status );
      $valid_post_statuses = array();

      foreach ( $post_status as $status ) {
        /*
        Check that:
        1. We actually have custom post statuses for this type
        2. We have this particular custom post status
        3. The custom post status can be showed in json
         */
        if ( ! empty( $this->post_statuses[$status] ) &&
          ! empty( $this->post_statuses[$status]['show_in_json'] ) &&
          $this->post_statuses[$status]['show_in_json'] === true ) {
          $valid_post_statuses[] = $status;
        }
      }

      return $valid_post_statuses;
    }

    return $post_status;
  }

  /**
   * Edit read permissions when we are allowing custom post statuses.
   * @param  boolean $permission The permission status so far.
   * @param  array   $post       The post we are talking about.
   * @return boolean             The edited permission.
   */
  public function allow_post_with_custom_status_reading( $permission, $post ) {
    /* If permission is already true, we don't need to edit it */
    if ( $permission ) return $permission;

    /*
    Check that:
    1. We are actually allowing custom post statuses
    2. We actually have custom post statuses for this type
    3. We have this particular custom post status
    4. The custom post status can be showed in json
     */
    if ( $this->allow_custom_post_statuses && ! empty( $this->post_statuses ) ) {
      $post_status = $post['post_status'];

      if ( ! empty( $this->post_statuses[$post_status] ) &&
        ! empty( $this->post_statuses[$post_status]['show_in_json'] ) &&
        $this->post_statuses[$post_status]['show_in_json'] === true ) {
        return true;
      }
    }

    return false;
  }

  protected function prepare_post( $post, $context = 'view' ) {
    /*
    If ACF is installed, use `get_field` for getting post meta fields and put
    them into a "fields" array.
     */
    if ( ! class_exists( 'acf' ) ) return parent::prepare_post( $post, $context );

    $fields = array();

    if ( ! empty( $this->fields ) ) {
      foreach ( $this->fields as $field ) {
        // TODO: this causes incompatibility with polylang (hence the @ operator)
        $fields[$field] = @get_field( $field, $post['ID'], true );
      }
    }

    return array_merge( parent::prepare_post( $post, $context ), array( 'fields' => $fields ) );
  }
}
