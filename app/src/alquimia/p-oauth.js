module.exports = function OAuthProvider() {
  var $http, $q, $cookies;

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
      accessToken, expiration;

  this.$get = ['$http', '$q', '$cookies', function( _$http, _$q, _$cookies ) {
    $http = _$http;
    $q = _$q;
    $cookies = _$cookies;

    return OAuth;
  }];

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
      setSecret: setSecret
    };
  }

  function setSecret( clientSecret ) {
    console.warn( 'In production, you should use TYPE_IMPLICIT when logging in within JavaScript.' );
    CLIENT_SECRET = clientSecret;
  }

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
      if ( accessToken && ! isExpired( expiration ) ) {
        setHttpDefault( accessToken );
        resolve();
        return;
      }

      var cookie = $cookies.get( COOKIE_KEY );

      if ( cookie ) {
        var data = atob( cookie ).split( ':' );
        expiration = data[1];

        if ( ! isExpired( expiration ) ) {
          accessToken = data[0];
          setHttpDefault( data[0] );
          resolve();
          return;
        }
      }

      var hash = location.hash.substring( 1 ).split( '&' ),
          hashObj = {};

      for ( var i = hash.length - 1; i >= 0; i-- ) {
        var fragment = hash[i].split( '=' );
        hashObj[fragment[0]] = fragment[1];
      }

      if ( hashObj.access_token ) {
        location.hash = '';
        accessToken = hashObj.access_token;
        expiration = saveToken( hashObj );
        resolve();
        return;
      }

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
          expiration = saveToken( response.data );
          resolve();
        }, function() {
          console.error( arguments );
        } );
      } else {
        console.error( 'OAuth: please provide the client secret.' );
      }
    } );
  }

  function saveToken( data ) {
    var now = new Date();
    var expiration = now.getTime() + data.expires_in * 1000;
    var cookie = btoa( [
      data.access_token,
      expiration,
      data.token_type,
      data.scope
    ].join( ':' ) );

    $cookies.put( COOKIE_KEY, cookie );
    setHttpDefault( data.access_token );
    return expiration;
  }

  function setHttpDefault( accessToken ) {
    $http.defaults.headers.common.Authorization = 'Bearer ' + accessToken;
  }

  function isExpired( expiration ) {
    return new Date().getTime() >= expiration;
  }
};
