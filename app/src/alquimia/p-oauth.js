/**
 * @ngdoc     service
 * @name      alquimia.alquimia:oauth
 * @requires  ngCookies
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 *
 * @description
 * Provides login using one of three OAuth2 authentication modes
 * (see {@link alquimia.alquimia:oauth#methods_login login}). It
 * works with or without the `angular-route` module installed and
 * with or without the `$location`'s html5Mode enabled.
 */
module.exports = function OAuthProvider() {
  var $window, $http, $q, $cookies, $location;

  var CLIENT_ID,
      CLIENT_SECRET,
      TYPE_CLIENT_CREDENTIALS = 'client_credentials',
      TYPE_USER_CREDENTIALS = 'password',
      TYPE_IMPLICIT = 'token',
      COOKIE_KEY = 'qOAuth2',
      SERVER,
      AUTHORIZE = 'authorize',
      TOKEN = 'token',
      shouldRetry = true,
      accessToken;

  this.$get = ['$window', '$http', '$q', '$cookies', '$location',
    function( _$window, _$http, _$q, _$cookies, _$location ) {

    $window = _$window;
    $http = _$http;
    $q = _$q;
    $cookies = _$cookies;
    $location = _$location;

    return OAuth;
  }];

  /**
   * @ngdoc    method
   * @name     OAuth
   * @methodOf alquimia.alquimia:oauth
   *
   * @param {string} server    The server oauth API endpoint URL.
   * @param {string} clientId  The application's client ID.
   * @param {string} cookieKey The key under which cookies will be saved. Default: 'qOAuth2'.
   *
   * @returns {object}
   * A new OAuth instance. It contains three constants that you should use when calling
   * {@link alquimia.alquimia:oauth#methods_login login}:
   *
   * - `TYPE_CLIENT_CREDENTIALS`: represents the OAuth2 Client Credentials grant type.
   * - `TYPE_USER_CREDENTIALS`: represents the OAuth2 User Credentials grant type.
   * - `TYPE_IMPLICIT`: represents the OAuth2 Implicit grant type.
   *
   * @description
   * Creates a new OAuth instance, from which you can call
   * {@link alquimia.alquimia:oauth#methods_login login}.
   *
   * The `server` param is usually the same URL you give to the {@link alquimia.alquimia:WPApi WPApi}
   * service, ending with `/oauth` instead of `/wp-json`.
   */
  function OAuth( server, clientId, cookieKey ) {
    if ( ! server ) throw Error( 'OAuth: please provide the server URL' );
    if ( ! clientId ) throw Error( 'OAuth: please provide the client ID' );

    CLIENT_ID = clientId;
    SERVER = server.replace( /([^\/])$/, '$1/' );
    COOKIE_KEY = cookieKey || COOKIE_KEY;

    return {
      TYPE_CLIENT_CREDENTIALS: TYPE_CLIENT_CREDENTIALS,
      TYPE_USER_CREDENTIALS: TYPE_USER_CREDENTIALS,
      TYPE_IMPLICIT: TYPE_IMPLICIT,

      login: login,
      logout: logout,
      setSecret: setSecret
    };
  }

  /**
   * @ngdoc    method
   * @name     setSecret
   * @methodOf alquimia.alquimia:oauth
   *
   * @param {string} clientSecret The application client secret.
   *
   * @description
   * Sets the client secret in case of login with `TYPE_CLIENT_CREDENTIALS` or `TYPE_USER_CREDENTIALS`.
   * **Use this only for testing purpose.** In production, you should use `TYPE_IMPLICIT` when logging
   * in within JavaScript.
   */
  function setSecret( clientSecret ) {
    console.warn( 'In production, you should use TYPE_IMPLICIT when logging in within JavaScript.' );
    CLIENT_SECRET = clientSecret;
  }

  /**
   * @ngdoc    method
   * @name     login
   * @methodOf alquimia.alquimia:oauth
   *
   * @param {string} type     The grant type. Use one of three constants from
   *                          {@link alquimia.alquimia:oauth#methods_oauth OAuth}.
   *                          Default: `TYPE_IMPLICIT`.
   * @param {string} username Optional. The username, in case you are using `TYPE_USER_CREDENTIALS`.
   * @param {string} password Optional. The password, in case you are using `TYPE_USER_CREDENTIALS`.
   *
   * @returns {Promise} A JavaScript `Promise`. If it resolves, all the future HTTP requests
   *                    (even the ones made by `Restangular`) will be automatically authenticated.
   *
   * @description
   * Attempts to log in using the provided grant type. In production, you should call this method
   * without arguments and let it log in through the Implicit grant type. If you use any grant type
   * that is not `TYPE_IMPLICIT`, call {@link alquimia.alquimia:oauth#methods_setSecret setSecret}
   * before this, or you will get an error (the client secret is required for any grant type except
   * Implicit).
   */
  function login( type ) {
    type = type || TYPE_IMPLICIT;

    if ( type == TYPE_USER_CREDENTIALS ) {
      var username = arguments[1],
          password = arguments[2];

      if ( ! ( username && password ) ) {
        reject( 'Username and password not provided' );
        return;
      }
    }

    return $q( function( resolve, reject ) {
      /* Token cached */
      if ( accessToken ) {
        resolve();
        return;
      }

      /* Token from cookies */
      var cookie = $cookies.get( COOKIE_KEY );

      if ( cookie ) {
        var data = atob( cookie ).split( ':' );
        accessToken = data[0];
        setHttpDefault( data[0] );
        resolve();
        return;
      }

      var hash = $window.location.hash.substring( 1 );

      /*
      Token from hash (without router or in html5 mode)
      Enclose everything in a function so we can set a hash variable
      without conflicts with the already declared one
       */
      if ( hash && ( function() {
        var hash = decodeHash( location.hash.substring( 1 ) );

        if ( hash.access_token ) {
          /*
          Two different ways for emptying the hash:
          If we don't have the router, just empty window.location, as $location wouldn't work.
          If we have the router, use $location, otherwise a page refresh is triggered causing
          an infinite loop.
           */
          try {
            angular.module( 'ngRoute' );
            $location.hash( '' );
          } catch ( e ) {
            location.hash = '';
          }

          accessToken = hash.access_token;
          saveToken( hash );
          resolve();
          return true;
        }
      } )() ) return;

      /* Token from server */
      var data = {};

      switch ( type ) {
        case TYPE_USER_CREDENTIALS:
          data.username = username;
          data.password = password;
          break;

        case TYPE_CLIENT_CREDENTIALS:
          break;

        case TYPE_IMPLICIT:
          var request = [], requestObj = {
            response_type: type,
            client_id: CLIENT_ID,
            redirect_uri: window.location.href
          };

          for ( var i in requestObj ) request.push( i + '=' + requestObj[i] );
          request = '?' + request.join( '&' );

          window.location.href = SERVER + AUTHORIZE + request;
          return;

        default:
          return;
      }

      if ( CLIENT_SECRET ) {
        $http( {
          method: 'POST',
          url: SERVER + TOKEN,
          headers: {
            Authorization: 'Basic ' + btoa( CLIENT_ID + ':' + CLIENT_SECRET )
          },
          data: angular.extend( data, {
            grant_type: type
          } ),
        } ).then( function( response ) {
          accessToken = response.data.access_token;
          saveToken( response.data );
          resolve();
        }, function() {
          console.error( arguments );
        } );
      } else {
        console.error( 'OAuth: please provide the client secret.' );
      }
    } );
  }

  function logout() {
    accessToken = null;
    $cookies.remove( COOKIE_KEY );
  }

  function saveToken( data ) {
    var expiration = new Date();
    expiration.setTime( expiration.getTime() + data.expires_in * 1000 );

    var cookie = btoa( [
      data.access_token,
      data.token_type,
      data.scope
    ].join( ':' ) );

    $cookies.put( COOKIE_KEY, cookie, { expires: expiration } );
    setHttpDefault( data.access_token );
  }

  function setHttpDefault( accessToken ) {
    $http.defaults.headers.common.Authorization = 'Bearer ' + accessToken;
  }

  function decodeHash( hash ) {
    var hashObj = {};

    if ( hash ) {
      /* $location adds a / after the hash */
      if ( hash.charAt( 0 ) == '/' ) hash = hash.substring( 1 );

      hash = hash.split( '&' );

      for ( var i = hash.length - 1; i >= 0; i-- ) {
        var fragment = hash[i].split( '=' );
        hashObj[fragment[0]] = fragment[1];
      }
    }

    return hashObj;
  }
};
