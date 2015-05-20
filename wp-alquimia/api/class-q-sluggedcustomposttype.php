<?php
/**
 * Utility class that allows to get a post ID from its slug
 */
class Q_JSON_SluggedCustomPostType extends WP_JSON_CustomPostType {
  /**
   * Returns a post ID from its slug
   * @param  string $slug The post slug
   * @return integer      The post ID
   */
  protected function get_post_id( $slug ) {
    global $wpdb;

    $post = $wpdb->get_row( $wpdb->prepare( "SELECT ID FROM $wpdb->posts WHERE post_name = %s;", $slug ) );
    if ( empty( $post ) ) return new WP_Error( 'json_invalid_post_slug', __( 'Invalid post slug', 'alquimia' ) );

    return $post->ID;
  }
}
