var fs = require( 'fs' );
var glob = require( 'glob' );

var action = process.argv[2];

var files = [
  'q-config.json',
  '.gitignore',
  'bower.json',
  'package.json',
  'app/.htaccess',
  'app/src',
  'app/scss',
  'app/views',
  'app/index.html',
  'test/e2e',
  'test/unit',
  'admin/wp-config.php',
  'admin/wp-config-sample.php'
];

switch ( action ) {
  case 'backup':
    backup();
    break;
  case 'restore':
    restore();
    break;
  case 'update':
    update();
    break;
  default:
    console.log( 'Error: unrecognized action.' );
    break;
}

function update() {
  console.log( 'Unavailable: find a way for downloading a Git repo into a zip file.' );
}

function restore() {
  var src = process.argv[3] || 'backup';

  if ( fileExists( src + '.zip' ) ) {
    var unzip = require( 'unzip' );

    fs.createReadStream( src + '.zip' ).pipe( unzip.Extract( { path: './' } ) ).on( 'close', function() {
      _restore( src );
      rmdir( src );
      rmdir( src + '.zip' );
    } );
  } else {
    _restore( src );
    rmdir( src );
  }
}

function _restore( what ) {
  var children = fs.readdirSync( what );

  for ( var i = children.length - 1; i >= 0; i-- ) {
    copy( what + '/' + children[i], children[i] );
  }
}

function backup() {
  var dest = process.argv[3] || 'backup';
  var zip = require( 'just-zip' );
  var config = JSON.parse( fs.readFileSync( './q-config.json' ) );
  var configFiles = readConfigFiles( config );

  files = files.concat( configFiles );
  rmdir( dest );

  for ( var i = files.length - 1; i >= 0; i-- ) {
    copy( files[i], dest + '/' + files[i] );
  }

  ( function( p, q ) {
    copy( p, dest + '/' + p );
    copy( q, dest + '/' + q );
  } )(
    'admin/wp-content/plugins/' + config.appName,
    'admin/wp-content/themes/void'
  );

  fs.closeSync( fs.openSync( dest + '.zip', 'w' ) );

  zip( dest, function( err ) {
    if ( err ) throw err;
    else rmdir( dest );
  } );
}

function readConfigFiles( config ) {
  return ( function( files ) {
    var ret = [];

    for ( var i = files.length - 1; i >= 0; i-- ) {
      if ( typeof( files[i] ) !== 'object' || ! files[i].length ) {
        throw new Error( 'extras and backup properties of q-config must be Arrays of Arrays' );
      }

      for ( var j = files[i].length - 1; j >= 0; j-- ) {
        ret.push( files[i][j] );
      }
    }

    return ret;
  } )( ( config.extras || [] ).concat( config.backup || [] ) );
}

/**
 * Copies a file or a directory and its content to a destination.
 * @param  {string}  src           The source directory to be copied.
 * @param  {string}  dest          The destination directory. It will be created
 *                                 if it doesn't exist.
 * @param  {boolean} globsCompiled Whether globs are already been applied or not.
 *                                 Pass true if you are certain that src doesn't
 *                                 contain globs or if you already extracted globs
 *                                 from it.
 */
function copy( src, dest, globsCompiled ) {
  globsCompiled = !! globsCompiled;

  var splitSrc = src.split( '/' );
  var splitDest = dest.split( '/' );

  var difference = splitSrc.length - splitDest.length;
  var convert = function( path ) {
    return path;
  };

  if ( difference > 0 ) {
    /* src path is longer (dest is outside) */
    difference = splitSrc.slice( 0, difference ).join( '/' ) + '/';
    var pattern = new RegExp( '^' + difference );

    convert = function( path ) {
      return path.replace( pattern, '' );
    };
  } else if ( difference < 0 ) {
    /* dest path is longer (dest is inside) */
    var root = splitDest.slice( 0, -difference ).join( '/' );
    if ( globsCompiled ) mkdir( root );

    convert = function( path ) {
      return root + '/' + path;
    };
  }

  if ( ! globsCompiled ) {
    var matches = glob.sync( src );
    for ( var i = matches.length - 1; i >= 0; i-- ) {
      copy( matches[i], convert( matches[i] ), true );
    }
    return;
  }

  if ( fs.lstatSync( src ).isDirectory() ) {
    walkFileTree( src, function( path, isDir ) {
      if ( isDir ) mkdir( convert( path ) );
      else _copy( path, convert( path ) );
    }, true );
  } else {
    var path = convert( src ).split( '/' );
    if ( path.length > 1 ) mkdir( path.slice( 0, -1 ).join( '/' ) );
    _copy( src, convert( src ) );
  }
}

/**
 * Recursively creates a directory tree.
 * @param  {string} path The directory tree (e.g.: 'path/to/my/dir').
 */
function mkdir( path ) {
  var segments = [];
  path = path.split( '/' );

  for ( var i = 0, ii = path.length; i < ii; i++ ) {
    segments.push( path[i] );
    var segment = segments.join( '/' );
    if ( ! fileExists( segment ) ) fs.mkdirSync( segment );
  }
}

/**
 * Recursively removes a directory even if it is not empty.
 * @param  {string} path The path to the directry to be deleted.
 */
function rmdir( path ) {
  walkFileTree( path, function( path, isDir ) {
    if ( isDir ) fs.rmdirSync( path );
    else fs.unlinkSync( path );
  } );
}

/**
 * Synchronously walks a file tree starting from a root directory. For each file (or folder)
 * calls the callback function.
 * @param  {string}   path      The root directory where to start.
 * @param  {Function} cb        The function to be called for each file. It is called with two
 *                              argument: the file path and a boolean that is true if the path
 *                              refers to a directory, false if it refers to a file.
 * @param  {boolan}   dirBefore If true, the callback function will be called with the folders
 *                              at first and with the folders' content after. If false, the
 *                              callback is called with the folders' content before and with
 *                              the containing folders after.
 */
function walkFileTree( path, cb, dirBefore ) {
  dirBefore = !! dirBefore;

  if ( fileExists( path ) ) {
    if ( dirBefore ) cb( path, true );

    var children = fs.readdirSync( path );

    if ( children.length ) {
      for ( var i = children.length - 1; i >= 0; i-- ) {
        var child = path + '/' + children[i];

        if ( fs.lstatSync( child ).isDirectory() ) {
          walkFileTree( child, cb, dirBefore );
        } else {
          cb( child, false );
        }
      }
    }

    if ( ! dirBefore ) cb( path, true );
  }
}

function _copy( src, dest ) {
  fs.writeFileSync( dest, fs.readFileSync( src ) );
}

function fileExists( path ) {
  return fs.existsSync( path );
}
