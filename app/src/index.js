( function() {

  // angular
  require( 'angular' );
  require( 'angular-sanitize' );

  window._ = require( 'lodash' );
  require( 'restangular' );

  // application
  // global.oauth = false;
  // require( './alquimia' );

  angular.module( 'Q_REPLACE_CAMELCASED', ['ngSanitize'] );
} )();
