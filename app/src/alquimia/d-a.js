/**
 * @ngdoc     directive
 * @name      alquimia.alquimia:a
 * @restrict  E
 * @priority  default
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 *
 * @description
 * If the `href` attribute contains a relative URL, rewrites it into an absolute URL. Use this directive
 * only together with `$location`'s **HTML5 mode**.
 *
 * This change allows to use links relative to the application base and not to the server root.
 *
 * # Requirements
 *
 * This directive requires a `<base>` tag into your page `<head>`. This is required by `$location` too,
 * in HTML5 mode. If you are not planning to use HTML5 mode, then this directive is useless for you.
 *
 * # Example
 *
 * If your application is running at `http://localhost:8000/app` and you want to link to `/home/products`,
 * you should normally write something like:
 *
 * `<a href="/app/home/products">My link</a>`
 *
 * This would most likely break when brought to production. Thanks to this directive, you can write your
 * `href` as if your application was running into the server root:
 *
 * `<a href="/home/products">My link</a>`
 *
 * And the actual reference will be:
 *
 * `<a href="http://localhost/app/home/products">My link</a>`
 */
module.exports = function( $location ) {
  var baseUrl, absoluteUrlPattern = /^(?:https?:\/\/)|(?:www)/;

  return {
    restrict: 'E',
    scope: {
      href: '@',
      ngHref: '@'
    },
    link: function( scope, element ) {
      if ( element.attr( 'href' ) && element.attr( 'href' ) != '#'
        && ! element.attr( 'ng-href' ) && ! absoluteUrlPattern.test( scope.href ) ) {
        baseUrl = baseUrl || getBaseUrl();

        if ( baseUrl ) {
          var href = getAbsoluteUrl( element );
          scope.href = href;
          element.attr( 'href', href );
        }
      }

      var stopWatching = scope.$watch( 'ngHref', function( value ) {
        if ( value && ! absoluteUrlPattern.test( value ) ) {
          baseUrl = baseUrl || getBaseUrl();
          if ( ! baseUrl ) stopWatching();

          var href = getAbsoluteUrl( element );
          element.attr( 'href', href );
        }
      } );
    }
  };

  function getAbsoluteUrl( el ) {
    return baseUrl + el.attr( 'href' );
  }

  function getBaseUrl() {
    var base = angular.element( document.getElementsByTagName( 'base' ) );

    if ( ! base.length ) return false;

    base = angular.element( base[0] ).attr( 'href' );

    return $location.protocol() + '://' + $location.host() + ':' +
      $location.port() + base.substring( 0, base.length - 1 );
  }
};
