/**
 * @ngdoc     overview
 * @name      alquimia
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 *
 * @description
 * The `alquimia` module provides utility objects for using the Alquimia framework as efficiently as possible.
 * The goal of this module is to help developers:
 *
 * - Handling `$location`'s **HTML5 mode** during development with the Node JS server
 * - Communicating with the Wordpress' **WP REST API** plugin and specifically with the Alquimia Wordpress plugin
 * for the API
 * - Handling OAuth authentication.
 *
 * > Set `globals.oauth = true;` before the `require( 'alquimia' );` instruction if you want to include the
 *   `oauthProvider`.
 */
var deps = ['restangular'];

if ( global.oauth ) deps.push( 'ngCookies' );

var module = angular.module( 'alquimia', deps );

if ( window.location && window.location.hostname === 'localhost' ) {
  module.directive( 'a', ['$location', require( './d-a' )] )
}

if ( global.oauth ) {
  module.provider( 'oauth', [require( './p-oauth' )] );

  try {
    angular.module( 'ngRoute' );

    module.config( ['$routeProvider', 'oauthProvider', function( $routeProvider, oauthProvider ) {
      $routeProvider.otherwise( {
        redirectTo: function( params, hash, search ) {
          if ( oauthProvider.setHash( hash ) ) return oauthProvider.getLoginRoute();
          return oauthProvider.getDefaultRoute();
        }
      } );
    } ] );
  } catch ( e ) {
    /* ngRoute doesn't exist. No one cares. */
  }
}

module.provider( 'WPApi', require( './p-wp-api' ) );
