/**
 * @ngdoc    service
 * @name     alquimia.alquimia:WPApi
 * @requires restangular
 * @author    Mauro Constantinescu <mauro.constantinescu@gmail.com>
 * @copyright © 2015 White, Red & Green Digital S.r.l.
 * 
 * @description
 * Allows to easily communicate with the Wordpress' **WP REST API** plugin and specifically with the
 * Alquimia Wordpress plugin for the API.
 */
module.exports = function WPApiProvider() {
  var $q, Restangular, defaultFilters;

  this.$get = ['$q', 'Restangular', function WPApiFactory( _$q, _Restangular ) {
    $q = _$q;
    Restangular = _Restangular;

    return WPApi;
  }];

  /**
   * @ngdoc    method
   * @name     WPApi
   * @methodOf alquimia.alquimia:WPApi
   * 
   * @param    {String} endpoint
   * The API endpoint name. This is defined by the API URL entry point fragment. For example, for the default "posts"
   * endpoint, handled by `WP_JSON_Posts`, the URL is `http://your.domain.com/wordpress/wp-json/posts` and the
   * `endpoint` parameter is "posts"
   * 
   * @param    {Object} config
   * A configuration object. It can contain two keys that defines the WPApi instance behaviour:
   * - `filters`: it can contain up to three objects, with keys `defaults`, `items` and `item`. The properties of these
   *   three object can be atomic values or functions and are used to send GET parameters out to the API. For example:
   *   
   *   ```
   *   new WPApi( 'posts', {
   *     filters: {
   *       defaults: {
   *         lang: function() { return getCurrentLanguage(); }
   *       },
   *       items: {
   *         posts_per_page: -1
   *       },
   *       item: {}
   *     }
   *   } );
   *   ```
   *   
   *   Means: send a `filter[lang]` parameter for every request, executing the `getCurrentLanguage` function and
   *   sending the returned value. When requesting all items (sending a request to `posts`), disable the pagination
   *   through a `filter[posts_per_page]=-1` parameter.
   *   
   *   You can add filter when requesting a single item (`posts/post-slug`) too, putting something into the `item` key.
   * - `transform`: a function used to transform the items returned from the API before they are cached and returned.
   *   It is called with two arguments:
   *   
   *   `items`, an array of items from the API. If {@link alquimia.alquimia:WPApi#methods_getItem getItem} was called,
   *   this will contain an array with a single item;
   *   
   *   `isCached`, a boolean that indicates whether the retrieved items come from cache or not.
   *
   *    Example:
   *
   *    ```
   *    new WPApi( 'posts', {
   *      transform: function( items, isCached ) {
   *        if ( ! isCached ) {
   *          // Loop through the items and edit them...
   *          // Cached items will be already edited
   *        }
   *
   *        if ( ! isCached ) {
   *          $rootScope.broadcast( 'itemsreceived' );
   *        }
   *
   *        return items;
   *      }
   *    } );
   *    ```
   *
   * @returns  {Object}
   * A `WPApi` instance mapped to the provided `endpoint` and configured to send `filters` and `transform`
   * the responses.
   *
   * @description
   * `WPApi` constructor.
   */
  function WPApi( endpoint, config ) {
    var backend = Restangular.all( endpoint );
    var items = [];
    var valid = true;
    var defaultFilters = {}, itemsFilters = {}, itemFilters = {};
    var transform;

    if ( config && angular.isObject( config ) ){
      if ( config.filters && angular.isObject( config.filters ) ) {
        defaultFilters = config.filters.defaults || defaultFilters;
        itemsFilters = config.filters.items || itemsFilters;
        itemFilters = config.filters.item || itemFilters;
      }

      if ( config.transform && angular.isFunction( config.transform ) ) {
        transform = config.transform;
      }
    }

    /**
     * @ngdoc    method
     * @name     getItems
     * @methodOf alquimia.alquimia:WPApi
     * 
     * @param {Boolean} flush
     * If `false` and this method was called before, the network request is skipped and the items are taken from
     * cache. If `true`, the network request is sent even if cached items are available.
     *
     * @param {Object} filters
     * An optional set of additional filters to be sent along with the API request. Default filters
     * from `config.filters.defaults` are merged with and overridden by items filters from `config.filters.items`,
     * that are merged with and overridden by these filters.
     *
     * @returns {Promise}
     * A Javascript Promise. The `resolve` function is called with a `Restangular` response as the only argument.
     * The `reject` function is called with a `WP_Error` from WP REST API`, that contains a `code` and a `message`
     * keys.
     *
     * @description
     * Sends a request for getting all the items from the WP REST API endpoint.
     */
    this.getItems = function( flush, filters ) {
      return $q( function( resolve, reject ) {
        filters = angular.extend( {}, defaultFilters, itemsFilters, filters );
        filters = parseFilters( filters );

        if ( valid && ! flush && items.length > 1 ) {
          if ( transform ) {
            var transformedItems = transform( items, true );
            if ( transformedItems ) items = transformedItems;
          }

          resolve( items );
          return;
        }

        backend.getList( filters ).then( function( response ) {
          items = response;

          if ( transform ) {
            var transformedItems = transform( items, false );
            if ( transformedItems ) items = transformedItems;
          }

          valid = true;
          resolve( items );
        }, function( error ) {
          return error.data[0];
        } );
      } );
    };

    /**
     * @ngdoc    method
     * @name     getItem
     * @methodOf alquimia.alquimia:WPApi
     *
     * @param {String} slug
     * The post slug to be requested. Usually, it is taken directly from the
     * {@link alquimia.alquimia:WPApi#methods_getItems getItems} response.
     * 
     * @param {Boolean} flush
     * If `false` and this method was called before, the network request is skipped and the items are taken from
     * cache. If `true`, the network request is sent even if cached items are available.
     *
     * @param {Object} filters
     * An optional set of additional filters to be sent along with the API request. Default filters
     * from `config.filters.defaults` are merged with and overridden by items filters from `config.filters.item`,
     * that are merged with and overridden by these filters.
     *
     * @returns {Promise}
     * A Javascript Promise. The `resolve` function is called with a `Restangular` response as the only argument.
     * The `reject` function is called with a `WP_Error` from WP REST API`, that contains a `code` and a `message`
     * keys.
     *
     * @description
     * Sends a request for getting one item from the WP REST API endpoint.
     */
    this.getItem = function( slug, flush, filters ) {
      return $q( function( resolve, reject ) {
        if ( ! flush && ( items.length > 1 || ( items.length && items[0].slug == slug ) ) ) {
          for ( var i = items.length - 1; i >= 0; i-- ) {
            if ( items[i].slug == slug ) {
              if ( transform ) {
                var transformedItems = transform( [items[i]], true );
                if ( transformedItems ) items[i] = transformedItems[0];
              }

              /*
              If items were cached, then the route is wrong (is the one returned from getItems())
              and calling methods of the item would cause 500 errors from the server. To prevent
              this, we reset the item route
               */
              items[i].route = endpoint + '/' + items[i].slug;

              resolve( items[i] );
              return;
            }
          }
        }

        filters = angular.extend( {}, defaultFilters, itemFilters, filters );
        filters = parseFilters( filters );

        backend.one( slug ).get( filters ).then( function( response ) {
          items = [response];

          if ( transform ) {
            var transformedItems = transform( items, false );
            if ( transformedItems ) items[0] = transformedItems[0];
          }

          resolve( response );
        }, function( error ) {
          return error.data[0];
        } );
      } );
    };

    /**
     * @ngdoc    method
     * @name     invalidate
     * @methodOf alquimia.alquimia:WPApi
     *
     * @description
     * Schedule the cache to be discarded on the next request. This is useful when you know that a request is
     * about to be sent, but the object that is going to send it doesn't know that the cache should be discarded.
     *
     * Let's say that your API can handle traslations and react to language inconsistencies, so if you request a
     * post that is in French, but your request has a GET parameter that says "German", it will return the German
     * post. You have a dropdown menu on your post page that lets a user pick a language.
     *
     * Now, let's say that a user lands on the French category page that shows all the posts with that category,
     * following a link a friend gave him, but he/she only speaks German. He/She changes language, and your
     * application does this:
     *
     * - Intentionally sends a request that asks for the French category with German language;
     * - picks the slug of the German translation;
     * - invalidates the WPApi cache;
     * - changes `$location` so the URL is consistent with the right category translation;
     * - asks for posts again.
     *
     * In this case, not invalidating the cache would have caused WPApi to serve the cached posts, because it
     * doesn't know that something changed. The post request couln't be done with `flush: true`, unless you
     * saved the last language before doing the request. This is why this method is useful.
     */
    this.invalidate = function() {
      valid = false;
    };

    function parseFilters( filters ) {
      var ret = {};

      for ( var i in filters ) {
        if ( angular.isFunction( filters[i] ) ) {
          ret['filter[' + i + ']'] = filters[i]();
        } else {
          ret['filter[' + i + ']'] = filters[i];
        }
      }

      return ret;
    }
  }
};
