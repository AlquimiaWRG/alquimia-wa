<?php

/*
Plugin Name: Q_REPLACE_HUMAN
Description:
Version: 0.1
Author:
Text Domain: Q_REPLACE_DASHED
Domain Path: /languages
Network: false
License: GPL2
*/

/*
This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2, as
published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

defined( 'ABSPATH' ) or die( 'You may not access this script from outside Wordpress.' );

if ( ! function_exists( 'add_action' ) ) {
  echo 'I can do nothing for you when called directly.';
  exit;
}

define( 'Q_REPLACE_SNAKECASED__VERSION', '0.1' );
define( 'Q_REPLACE_SNAKECASED__MINIMUM_WP_VERSION', '4.1.1' );
define( 'Q_REPLACE_SNAKECASED__PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'Q_REPLACE_SNAKECASED__CLASSES_DIR', Q_REPLACE_SNAKECASED__PLUGIN_DIR . 'classes/' );

add_action( 'plugins_loaded', 'Q_REPLACE_UNDERSCORED_setup' );

function Q_REPLACE_UNDERSCORED_setup() {
  if ( class_exists( 'Alquimia' ) ) {
    require_once Q_REPLACE_SNAKECASED__CLASSES_DIR . 'class-Q_REPLACE_DASHED.php';
    global $Q_REPLACE_UNDERSCORED;
    $Q_REPLACE_UNDERSCORED = new Q_REPLACE_TITLED();
  } else {
    add_action( 'admin_notices', 'Q_REPLACE_UNDERSCORED_missing_alquimia_notice' );
  }
}

function Q_REPLACE_UNDERSCORED_missing_alquimia_notice() {
  ?>
  <div class="error">
    <p>
      <?php
        _e(
          'The Q_REPLACE_HUMAN plugin needs the Alquimia plugin to be installed and active in order to work.',
          'Q_REPLACE_DASHED'
        );
      ?>
    </p>
  </div>
  <?php
}
