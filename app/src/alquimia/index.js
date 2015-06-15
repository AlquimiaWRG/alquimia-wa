/**
 * @ngdoc     overview
 * @name      alquimia
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 *
 * @description
 * The `alquimia` module provides utility objects for using the Alquimia framework as efficiently as possible.
 * The main goal of this module is to help developers handling `$location`'s **HTML5 mode** and communicating
 * with the Wordpress' **WP REST API** plugin and specifically with the Alquimia Wordpress plugin for the API.
 */
var module = angular.module( 'alquimia', ['restangular'] )

if ( window.location && window.location.hostname === 'localhost' ) {
  module.directive( 'a', ['$location', require( './d-a' )] )
}

if ( global.oauth ) {
  module.provider( 'oauth', require( './p-oauth' ) );
}

module.provider( 'WPApi', require( './p-wp-api' ) );
