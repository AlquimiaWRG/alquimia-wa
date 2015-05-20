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
angular.module( 'alquimia', ['restangular'] )
/*
Uncomment this directive if you want to use $location's html5Mode. You should keep it
into your project only while developing. For more information, see the readme file.
 */
// .directive( 'a', ['$location', require( './d-a' )] )
.provider( 'WPApi', require( './p-wp-api' ) );
