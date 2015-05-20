<?php
/**
 * @package   alquimia
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 * 
 * Base class of the Alquimia plugin. Handles custom post types and taxonomies, renaming "post" post type
 * and existing taxonomies (category and post_tag), custom post statuses, i10n, custom users groups and
 * capabilities and WP_REST_API custom endpoints. Works well with Polylang and/or Advanced Custom Fields
 * Wordpress plugins.
 */
class Alquimia {
  /**
   * Wordpress default capability prefixes.
   * @var array
   */
  private $caps;

  /**
   * Plugin slug, used for loading languages files. This must be overridden and equals to the plugin
   * text domain.
   * @var string
   */
  protected $name = 'alquimia';
  /**
   * Plugin directory name. This must be overridden.
   * @var [type]
   */
  protected $plugin_dir;

  /**
   * An array of custom post types, in the form:
   * ```
   * 'post_type_name' => array(
   *   // post type options, like 'labels', 'public' etc.
   *   // see http://codex.wordpress.org/Function_Reference/register_post_type
   * )
   * ```
   * You can put here 'post' too, and the options will be merged with the
   * default 'post' ones.
   * @var array
   */
  protected $post_types;
  /**
   * An array of custom taxonomies associated to a post type, in the form:
   * ```
   * 'post_type_name' => array(
   *   'taxonomy_name' => array(
   *     // taxonomy options, like 'labels', 'public' etc.
   *     // see http://codex.wordpress.org/Function_Reference/register_taxonomy
   *   )
   * )
   * ```
   * You can put here 'category' and 'post_tag' too, and the options will be merged with the
   * default ones.
   * @var array
   */
  protected $taxonomies;
  /**
   * A map of taxonomies associated with their post type, in the form:
   * ```
   * 'post_type_name' => array( 'taxonomy_name', ... )
   * ```
   * It's not required for the relationship `'post' => array( 'category', 'post_tag' )` to
   * be included, as that is natively defined into Wordpress.
   * @var array
   */
  protected $terms_map;
  /**
   * An array of custom post statuses associated with their post type, in the form:
   * ```
   * 'post_type_name' => array(
   *   'post-status-slug' => array(
   *      // 'label', 'public' and 'label_count' options
   *      // see https://codex.wordpress.org/Function_Reference/register_post_status
   *      // show_in_json => true|false (optional) Default: false
   *   )
   * )
   * ```
   * NOTE: you must set 'show_in_json' to true if you want the API to return posts
   * with the custom post status.
   * @var array
   */
  protected $post_statuses;

  /**
   * The api prefix. This must be the same as the prefix contained into the file names
   * into the `api` directory and the one into the classes name. For example, if you want
   * to create the 'my-post-type' API endpoint and your prefix is 'my', your file must
   * be named as "class-my-json-myposttype.php" and your class as "MY_JSON_MyPostType".
   * @var string
   */
  protected $api_prefix = 'q';
  /**
   * An array of custom endpoints, for example 'posts' or 'my-post-type'.
   * @var array
   */
  protected $api_endpoints;

  public function __construct() {
    /* $plugin_dir and $name must be overridden */
    if ( empty( $this->plugin_dir ) ) {
      _doing_it_wrong( 'Alquimia::__construct', 'The plugin dir must be overridden', ALQUIMIA__VERSION );
    }
    if ( empty( $this->name ) ) {
      _doing_it_wrong( 'Alquimia::__construct', 'The plugin name must be overridden', ALQUIMIA__VERSION );
    }

    $this->caps = array( 'edit_', 'read_', 'delete_', 'edit_', 'edit_others_', 'publish_', 'read_private_', 'delete_',
      'delete_private_', 'delete_published_', 'delete_others_', 'edit_private_', 'edit_published_' );

    register_activation_hook( $this->plugin_dir . "$this->name.php", array( $this, 'activate' ) );
    register_deactivation_hook( $this->plugin_dir . "$this->name.php", array( $this, 'deactivate' ) );

    if ( is_admin() ) {
      add_action( 'init', array( $this, 'rename_data' ) );
      add_action( 'admin_init', array( $this, 'rename_menus' ) );
      add_action( 'admin_footer-post.php', array( $this, 'populate_post_status_dropdown' ) );
      add_action( 'admin_footer-post-new.php', array( $this, 'populate_post_status_dropdown' ) );
    }

    add_action( 'plugins_loaded', array( $this, 'init' ) );
    add_action( 'init', array( $this, 'register_data' ) );
    add_action( 'wp_json_server_before_serve', array( $this, 'init_api' ) );
  }

  public function init() {
    /* Eventually load the languages for the plugin that is extending this */
    if ( $this->name != 'alquimia' ) {
      $path = "$this->name/languages";
      $is_loaded = load_plugin_textdomain( $this->name, false, $path );
    }

    /* Add the translations immediately if the Polylang plugin is not active, otherwise wait for it */
    if ( defined( 'PLL_ADMIN' ) && PLL_ADMIN ) {
      add_action( 'pll_language_defined', array( $this, 'add_translations' ) );
    } else {
      $this->add_translations();
    }
  }

  /**
   * Called as soon as translations can be added. Use gettext functions here.
   * Using them before (like in `__construct` or `init`) doesn't work.
   */
  public function add_translations() {}
  
  /**
   * Activation function, in case you want to add one just override this
   */
  public function activate() {}
  /**
   * Deactivation function, in case you want to add one just override this
   */
  public function deactivate() {}

  /**
   * Initializes the WP_REST_API custom endpoints, taking them from $api_endpoints
   * @param  WP_JSON_Server $server see http://wp-api.org/
   */
  public function init_api( $server ) {
    if ( defined( 'JSON_API_VERSION' ) && ! empty( $this->api_prefix ) && ! empty( $this->api_endpoints ) ) {
      require_once ALQUIMIA__PLUGIN_DIR . 'api/class-q-sluggedcustomposttype.php';
      require_once ALQUIMIA__PLUGIN_DIR . 'api/class-q-json-customposttype.php';

      foreach ( $this->api_endpoints as $api_endpoint ) {
        $endpoint_filename = str_replace( '-', '', $api_endpoint );

        require_once $this->plugin_dir . "api/class-$this->api_prefix-json-$endpoint_filename.php";

        $object = strtoupper( $this->api_prefix ) . '_JSON_';
        $matches = explode( '-', $api_endpoint );

        foreach ( $matches as &$match ) $match = ucfirst( $match );

        $object .= implode( '', $matches );
        $object = new $object( $server );

        if ( ! empty( $this->post_statuses ) ) {
          if ( method_exists( $object, 'get_type' ) ) {
            $type = $object->get_type();

            if ( ! empty( $this->post_statuses[$type] ) ) {
              $object->allow_custom_post_statuses( true );
              $object->set_post_statuses( $this->post_statuses[$type] );
            }
          }
        }

        add_filter( 'json_endpoints', array( $object, 'register_routes' ) );
      }
    }
  }

  /**
   * Registers custom post types, taxonomies and post stauses using $post_types, $taxonomies,
   * $terms_map and $post_statuses
   */
  public function register_data() {
    /* Register post types */
    if ( ! empty( $this->post_types ) ) {
      foreach ( $this->post_types as $post_type => $options ) {
        if ( $post_type != 'post' ) {
          register_post_type( $post_type, $options );
        }
      }
    }

    /* Register taxonomies */
    if ( ! empty( $this->taxonomies ) ) {
      foreach ( $this->taxonomies as $post_type => $taxonomies ) {
        foreach ( $taxonomies as $taxonomy => $options ) {
          if ( $taxonomy != 'category' && $taxonomy != 'post_tag' ) {
            register_taxonomy( $taxonomy, $post_type, $options );
          }
        }
      }
    }

    /* Register taxonomies for post types */
    if ( ! empty( $this->terms_map ) ) {
      foreach ( $this->terms_map as $post_type => $taxonomies ) {
        foreach ( $taxonomies as $taxonomy ) {
          register_taxonomy_for_object_type( $taxonomy, $post_type );
        }
      }
    }

    /* Register post statuses */
    if ( ! empty( $this->post_statuses ) ) {
      foreach ( $this->post_statuses as $post_type => $post_statuses ) {
        foreach ( $post_statuses as $name => $post_status ) {
          register_post_status( $name, $post_status );
        }
      }
    }
  }

  /**
   * If needed, renames native Wordpress entities' labels (post, category and post_tag)
   */
  public function rename_data() {
    if ( ! empty( $this->post_types ) && ! empty( $this->post_types['post'] ) ) {
      global $wp_post_types;

      $args = get_post_type_object( 'post' );
      unset( $wp_post_types['post'] );

      $args_array = get_object_vars( $args );
      $args = array_merge( $args_array, $this->post_types['post'] );

      register_post_type( 'post', $args );
    }

    $edited_category = ! empty( $this->taxonomies ) &&
                       ! empty( $this->taxonomies['post'] ) &&
                       ! empty( $this->taxonomies['post']['category'] );
    $edited_post_tag = ! empty( $this->taxonomies ) &&
                       ! empty( $this->taxonomies['post'] ) &&
                       ! empty( $this->taxonomies['post']['post_tag'] );
    
    if ( $edited_category || $edited_post_tag ) {
      global $wp_taxonomies;

      if ( $edited_category ) {
        $category = $wp_taxonomies['category'];
        unset( $wp_taxonomies['category'] );

        $args = array_merge( get_object_vars( $category ), $this->taxonomies['post']['category'] );
        register_taxonomy( 'category', 'post', $args );
      }

      if ( $edited_post_tag ) {
        $post_tag = $wp_taxonomies['post_tag'];
        unset( $wp_taxonomies['post_tag'] );

        $args = array_merge( get_object_vars( $post_tag ), $this->taxonomies['post']['post_tag'] );
        register_taxonomy( 'post_tag', 'post', $args );
      }
    }
  }

  /**
   * If needed, renames post admin menu entries
   */
  public function rename_menus() {
    if ( ! empty( $this->post_types ) && ! empty( $this->post_types['post'] ) ) {
      global $menu;
      global $submenu;

      $post = get_post_type_object( 'post' );

      $menu_name = $post->labels->menu_name;
      $all_items = $post->labels->all_items;
      $add_new_item = $post->labels->add_new_item;

      $menu[5][0] = $menu_name;
      $submenu['edit.php'][5][0] = $all_items;
      $submenu['edit.php'][10][0] = $add_new_item;
    }
  }

  /**
   * Prints a script that populates the post status dropdown into the "Create post" and "Edit post" admin
   * pages, placing the custom post statuses.
   */
  public function populate_post_status_dropdown() {
    global $post;
    if ( ! empty( $this->post_statuses ) && in_array( $post->post_type, array_keys( $this->post_statuses ) ) ) {
      ?>
      <script>
        jQuery( function( $ ) {

          /* Kindly printed by PHP */
          var statuses = {
            <?php foreach ( $this->post_statuses[$post->post_type] as $name => $post_status ): ?>
            '<?php echo $name; ?>': '<?php echo $post_status["label"]; ?>',
            <?php endforeach; ?>
          };

          var $dropdown = $( '#post_status' );
          var currentStatus = '<?php echo $post->post_status; ?>';

          /*
          Show published posts, so if a post was published for some reason,
          we can bring it back to another status
           */
          if ( currentStatus == 'auto-draft' || currentStatus in statuses ) {
            /* Hide default publish button */
            $( '#publish' ).hide();

            /*
            Change the label of the "Save draft" button to "Update". Some Wordpress script keep changing it
            back to "Save draft" every time the status is changed by the user, so we remove the id attribute
            from it making it unreachable. This cause the button to float to the right because Wordpress uses
            its id into the CSS, so we make it "float: left".
             */
            $( '#save-post' )
              .css( 'float', 'left' )
              .prop( 'id', '' )
              .attr( 'value', '<?php _e( "Update" ); ?>' );
          }

          /* Create dropdown menu options */
          for ( var i in statuses ) {
            var $option = $( document.createElement( 'option' ) )
              .prop( 'value', i ).html( statuses[i] )
              .prop( 'selected', i == currentStatus );
            $dropdown.append( $option );
          }

          /* Change the label of the current status to the right custom one */
          $( '#post-status-display' ).html( statuses[currentStatus] );
        } );
      </script>
      <?php
    }
  }

  /**
   * Adds or removes a capability from a user role
   * @param  string  $role      The user role which capabilities should be changed
   * @param  string  $post_type The post type we are talking about
   * @param  boolean $assign    true for adding capabilities, false for removing them
   */
  protected function toggle_cap( $role, $post_type, $assign ) {
    $role = get_role( $role );

    foreach ( $this->caps as $cap ) {
      if ( $assign ) $role->add_cap( $cap . $post_type );
      else $role->remove_cap( $cap . $post_type );
    }
  }
}
