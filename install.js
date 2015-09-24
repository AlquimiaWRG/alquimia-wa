var fs = require( 'fs' );
var unzip = require( 'unzip' );
var del = require( 'del' );

console.log( 'Initializing...' );

var isLite = process.argv[2] == 'lite';
var config = JSON.parse( fs.readFileSync( './q-config.json' ) );

// Q_REPLACE_DASHED -> my-app
// Q_REPLACE_CAMELCASED -> myApp
// Q_REPLACE_HUMAN -> My App
// Q_REPLACE_SNAKECASED -> MY_APP
// Q_REPLACE_TITLED -> MyApp
// Q_REPLACE_UNDERSCORED -> my_app
var substitutions = {},
    appName = config.appName;

substitutions['Q_REPLACE_DASHED'] = appName;
substitutions['Q_REPLACE_CAMELCASED'] = appName.replace( /-([a-z])/g, function( match, capture ) {
  return capture.toUpperCase();
} );
substitutions['Q_REPLACE_HUMAN'] = ( function() {
  var res = appName.replace( /-([a-z])/g, function( match, capture ) {
    return ' ' + capture.toUpperCase();
  } );
  return res.charAt( 0 ).toUpperCase() + res.substring( 1 );
} )();
substitutions['Q_REPLACE_UNDERSCORED'] = appName.replace( '-', '_' );
substitutions['Q_REPLACE_SNAKECASED'] = substitutions['Q_REPLACE_UNDERSCORED'].toUpperCase();
substitutions['Q_REPLACE_TITLED'] = substitutions['Q_REPLACE_CAMELCASED'].charAt( 0 ).toUpperCase() +
  substitutions['Q_REPLACE_CAMELCASED'].substring( 1 );

console.log( 'Creating "' + substitutions['Q_REPLACE_HUMAN'] + '" application...' );

var paths = [
  '.gitignore',
  'app/index.html',
  'app/.htaccess',
  'app/src/index.js',
  'wp-sample/sample.php',
  'wp-sample/classes/class-sample.php'
];

for ( var i = paths.length - 1; i >= 0; i-- ) {
  var data = fs.readFileSync( paths[i], 'utf-8' );

  for ( var string in substitutions ) {
    data = data.replace( new RegExp( string, 'g' ), substitutions[string] );
  }

  fs.writeFileSync( paths[i], data, 'utf-8' );
}

var finish = function() {
  console.log( 'Alquimia installed.' );
};

if ( ! isLite ) {
  var file = fs.createWriteStream( 'wordpress.zip' );
  var download = require( './download' );

  console.log( 'Downloading Wordpress...' );

  download( 'https://wordpress.org/latest.zip', file, function() {
    console.log( 'Extracting...' );

    fs.createReadStream( file.path ).pipe( unzip.Extract( { path: './' } ) ).on( 'close', function() {
      console.log( 'Moving and cleaning stuff...' );

      var samplePluginPath = 'admin/wp-content/plugins/' + appName;
      fs.renameSync( 'wordpress', 'admin' );
      fs.renameSync( 'wp-alquimia', 'admin/wp-content/plugins/alquimia' );
      fs.renameSync( 'wp-sample', samplePluginPath );

      fs.renameSync( samplePluginPath + '/sample.php',
        samplePluginPath + '/' + appName + '.php' );
      fs.renameSync( samplePluginPath + '/classes/class-sample.php',
        samplePluginPath + '/classes/class-' + appName + '.php' );

      fs.renameSync( 'wp-void', 'admin/wp-content/themes/void' );
      fs.unlink( 'wordpress.zip' );
      finish();
    } );
  } );
} else {
  console.log( 'Moving and cleaning stuff...' );
  del( ['wp-alquimia', 'wp-sample', 'wp-void'], finish );
}
