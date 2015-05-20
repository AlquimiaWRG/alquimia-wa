var fs = require( 'fs' );

var config = JSON.parse( fs.readFileSync( './q-config.json' ) );

var useTemplates = config.useTemplates;
var useTranslations = config.useTranslations;
var useHtml5Mode = config.useHtml5Mode;
var googleAnalyticsCode = config.googleAnalyticsCode;
var productionBasePath = config.productionBasePath;
var extras = config.extras;
var useLiveReload = config.useLiveReload;
var serverPort = config.serverPort;
var livereloadServerPort = config.livereloadServerPort;

var gulp = require( 'gulp' );
var Promise = require( 'promise' );
var del = require( 'del' );
var browserify = require( 'browserify' );
var debowerify = require( 'debowerify' );
var watchify = require( 'watchify' );
var source = require( 'vinyl-source-stream' );
var plugins = require( 'gulp-load-plugins' )();
var express = require( 'express' );
var livereload = require( 'tiny-lr' );
var connect = require( 'connect-livereload' );
var autoprefixer = require( 'autoprefixer-core' );
var modRewrite = require( 'connect-modrewrite' );

var p = {
  app: 'app',
  dist: 'dist',
  scriptsSrc: 'src',
  scriptsDest: 'js',
  scriptsEntry: 'index.js',
  stylesSrc: 'scss',
  stylesDest: 'styles',
  templatesDir: 'views',
  extra: extras
};

var SCRIPT_DEFAULT = 0, SCRIPT_START = 1, SCRIPT_BUILD = 2,
    SCRIPT_PRODUCE = 3, SCRIPT_INIT = 4;
var building = false;
var root = p.app, script = SCRIPT_DEFAULT;
var appName = __dirname.split( '/' ).pop();
var base = productionBasePath;

gulp.task( 'default', function() {
  execute();
} );

gulp.task( 'start', function() {
  script = SCRIPT_START;
  execute();
} );

gulp.task( 'init', function() {
  script = SCRIPT_INIT;
  execute();
} );

gulp.task( 'build', function() {
  root = p.dist;
  script = SCRIPT_BUILD;
  building = true;
  execute();
} );

gulp.task( 'produce', function() {
  root = p.dist;
  script = SCRIPT_PRODUCE;
  building = true;
  execute();
} );

function execute() {
  if ( script != SCRIPT_PRODUCE ) {
    base = path( '', appName, root, '' );
  }

  switch ( script ) {
    case SCRIPT_DEFAULT:
    case SCRIPT_START:
    case SCRIPT_INIT:
      scripts().then( styles ).then( templates ).then( htaccess )
        .then( inject ).then( startServer ).then( startWatchers );
      break;
    case SCRIPT_BUILD:
    case SCRIPT_PRODUCE:
      createDist().then( copyExtra ).then( styles ).then( distScript )
        .then( htaccess ).then( inject );
      break;
    default:
      break;
  }
}

function startWatchers() {
  return new Promise( function( fulfil ) {
    gulp.watch( path( p.app, p.stylesSrc, '**', '*.scss' ), function() {
      styles().then( function() {
        notifyLiveReload( '/styles/style.css' );
      } );
    } );

    gulp.watch( path( p.app, 'index.html' ), function() {
      notifyLiveReload( '/index.html' );
    } );

    gulp.watch( path( p.app, p.templatesDir, '**', '*.html' ), function() {
      templates().then( function() {
        notifyLiveReload( '/js/templates.js' );
      } );
    } );

    plugins.util.log( 'Watchers started' );
    fulfil();
  } );
}

function createDist() {
  return new Promise( function( fulfil ) {
    plugins.util.log( 'Initializing build...' );

    del( p.dist, function() {
      var pipeline = gulp.src( p.app + '/index.html' );

      if ( googleAnalyticsCode ) {
        pipeline = pipeline.pipe( plugins.inject( gulp.src( p.app + '/analytics.js' ), {
          starttag: '<!-- inject:analytics -->',
          transform: function( filePath, file ) {
            return file.contents.toString( 'utf8' );
          }
        } ) )
        .pipe( plugins.replace( 'UA-XXXXX-X', googleAnalyticsCode ) );
      }

      pipeline = pipeline.pipe( gulp.dest( p.dist ) )
        .on( 'end', fulfil );
    } );
  } );
}

function notifyLiveReload( file ) {
  livereload.changed( {
    body: {
      files: [
        p.app + file
      ]
    }
  } );
}

function styles() {
  return new Promise( function( fulfil ) {
    del( path( root, p.stylesDest, '*' ), function() {
      plugins.util.log( 'Rebuilding application styles' );

      var sassOptions = { precision: 5 };

      if ( building ) {
        sassOptions.style = 'compressed';
      } else {
        sassOptions.sourcemap = true;
      }

      var pipeline = plugins.rubySass( path( p.app, p.stylesSrc, 'style.scss' ), sassOptions )
        .pipe( plugins.postcss( [autoprefixer] ) )
        .on( 'error', plugins.util.log );

      if ( building ) {
        pipeline = pipeline.pipe( plugins.streamify( plugins.rev() ) );
      } else {
        pipeline = pipeline.pipe( plugins.sourcemaps.write() );
      }

      pipeline = pipeline.pipe( gulp.dest( path( root, p.stylesDest ) ) )
        .on( 'end', fulfil )
        .on( 'error', plugins.util.log );
    } );
  } );
}

function scripts() {
  return new Promise( function( fulfil ) {
    plugins.util.log( 'Rebuilding application JS bundle' );

    var b = browserify( {
      cache: {},
      packageCache: {},
      fullPaths: true,
      transform: debowerify,
      debug: true
    } );

    b = watchify( b );
    b.on( 'update', function() {
      rebundle( b ).then( function() {
        notifyLiveReload( '/js/app.js' );
      } );
    } );

    function rebundle() {
      return new Promise( function( fulfil ) {
        del( path( root, p.scriptsDest, '/app*.js' ), function() {
          var pipeline = b.bundle()
            .pipe( source( 'app.js' ) )
            .pipe( gulp.dest( path( root, p.scriptsDest ) ) )
            .on( 'end', fulfil )
            .on( 'error', plugins.util.log );
        } );
      } );
    }

    b.add( path( '.', p.app, p.scriptsSrc, p.scriptsEntry ) );
    rebundle( b ).then( fulfil );
  } );
}

function templates() {
  return new Promise( function( fulfil ) {
    del( path( root, p.scriptsDest, 'templates*.js' ), function() {
      if ( useTemplates ) {
        plugins.util.log( 'Rebuilding templates' );

        var moduleName = appName.replace( /-([a-z])/g, function( match, capture ) {
          return capture.toUpperCase();
        } );
        var appPath = __dirname + '/';

        gulp.src( path( p.app, p.templatesDir, '**', '*.html' ) )
          .pipe( plugins.htmlmin( {
            collapseWhitespace: true,
            removeComments: true
          } ) )
          .pipe( plugins.templatecache( {
            output: '/templates.js',
            strip: appPath + p.app + '/',
            moduleName: moduleName
          } ) )
          .pipe( gulp.dest( path( root, p.scriptsDest ) ) )
          .on( 'end', fulfil )
          .on( 'error', plugins.util.log );
      } else {
        fulfil();
      }
    } );
  } );
}

function copyExtra() {
  return new Promise( function( fulfil ) {
    for ( var i = p.extra.length - 1; i >= 0; i-- ) {
      var dest = [];

      var path = p.extra[i][0].split( '/' );
      dest = path.slice( 1, path.length - 1 );
      if ( dest[dest.length - 1] == '**' ) dest.pop();
      dest = dest.join( '/' );

      del( dest, ( function( i, dest ) {
        return function() {
          plugins.util.log( 'Copying ' + plugins.util.colors.green( dest ) );
          gulp.src( p.extra[i] ).pipe( gulp.dest( p.dist + '/' + dest ) );
        };
      } )( i, dest ) );
    }

    fulfil();
  } );
}

function startServer() {
  return new Promise( function( fulfil ) {
    if ( useLiveReload ) {
      plugins.util.log( 'Starting server' );

      var app = express();

      if ( useHtml5Mode ) {
        var redirects = [];
        redirects.push( '^/' + p.app + '([^\.]*)/?$ /' + p.app + '/#/$1 [L]' );
        redirects.push( '^/' + p.app + '(.*)$ - [L]' );
        redirects.push( '^/(.*)$ /' + p.app + '/$1 [R]' );
        app.use( modRewrite( redirects ) );
      }

      app.use( connect( { port: livereloadServerPort } ) )
        .use( express.static( __dirname ) )
        .listen( serverPort );

      livereload = livereload();
      livereload.listen( livereloadServerPort );
    }

    if ( script == SCRIPT_INIT ) {
      plugins.util.log( 'Starting default browser' );
      plugins.run( 'npm run start-safe' ).exec();
    }

    if ( script == SCRIPT_START ) {
      plugins.util.log( 'Starting Chrome in unsafe mode' );
      plugins.run( 'npm run start' ).exec();
    }

    fulfil();
  } );
}

function path() {
  return Array.prototype.join.call( arguments, '/' );
}

function inject() {
  return new Promise( function( fulfil ) {
    var createScript = function( name ) {
      return '<script type="text/javascript" src="' + p.scriptsDest + '/' +
        name + '.js"></script>';
    };

    var createLink = function( name ) {
      return '<link rel="stylesheet" href="' + p.stylesDest + '/' +
        name + '.css"></script>';
    };

    var tags = [''];

    if ( useHtml5Mode ) {
      var baseHref = base;

      if ( useLiveReload && root == p.app ) {
        baseHref = baseHref.split( '/' );
        baseHref.splice( 1, 1 );
        baseHref = baseHref.join( '/' );
      }

      tags.push( '<base href="' + baseHref + '">' );
    }

    var finish = function() {
      var pattern = /(<\!--\s*alquimia\s*-->)((?:.|[\r\n])*)(<\!--\s*end:alquimia\s*-->)/m;

      tags.push( '' );
      tags = tags.join( '\n  ' );

      gulp.src( path( root, 'index.html' ) )
        .pipe( plugins.replace( pattern, '$1' + tags + '$3' ) )
        .pipe( gulp.dest( root ) )
        .on( 'error', plugins.util.log )
        .on( 'end', fulfil );
    };

    if ( root == p.app ) {
      tags.push( createLink( 'style' ) );
      tags.push( createScript( 'app' ) );
      if ( useTemplates ) tags.push( createScript( 'templates' ) );
      if ( useTranslations ) tags.push( createScript( 'translations' ) );
      finish();
    }
    else {
      var Path = require( 'path' );

      gulp.src( [
        path( root, p.scriptsDest, 'scripts*.js' ),
        path( root, p.stylesDest, 'style*.css' )
      ], { read: false } )
        .pipe( plugins.tap( function( file, t ) {
          var extension = Path.extname( file.path );
          var filename = Path.basename( file.path, extension );
          var foo;

          switch ( extension ) {
            case '.js':
              foo = createScript;
              break;
            case '.css':
              foo = createLink;
              break;
            default:
              break;
          }

          if ( foo ) {
            tags.push( foo.call( this, filename, extension ) );
          }

          return t;
        } ) )
        .on( 'end', finish );
    }
  } );
}

function distScript() {
  return new Promise( function( fulfil ) {
    plugins.util.log( 'Building global JS bundle' );

    gulp.src( path( p.app, p.scriptsDest, '*.js' ) )
      .pipe( plugins.concat( 'scripts.js' ) )
      .pipe( plugins.streamify( plugins.uglify() ) )
      .pipe( plugins.streamify( plugins.rev() ) )
      .pipe( gulp.dest( path( p.dist, p.scriptsDest ) ) )
      .on( 'end', fulfil );
  } );
}

function htaccess() {
  return new Promise( function( fulfil ) {
    if ( useHtml5Mode || root != p.dist ) {
      var pipeline = gulp.src( path( p.app, '.htaccess' ) )
        .pipe( plugins.replace( /(RewriteRule \.\* ).*/, '$1' + base + 'index.html' ) );

      if ( useHtml5Mode ) {
        pipeline = pipeline.pipe( plugins.replace( /#\s*Rewrite/g, 'Rewrite' ) );
      } else {
        pipeline = pipeline.pipe( plugins.replace( /Rewrite/g, '# Rewrite' ) );
      }

      pipeline = pipeline.pipe( gulp.dest( root ) )
        .on( 'end', fulfil );
    } else {
      fulfil();
    }
  } );
}
