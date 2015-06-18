module.exports = function( url, file, cb ) {
  var https = require( 'https' );

  https.get( url, function( response ) {
    var filesize = response.headers['content-length'];
    var downloaded = 0;
    var progress;

    if ( filesize ) {
      progress = function() {
        return parseInt( downloaded / filesize * 100 ) + '%';
      };
    } else {
      var steps = ['/', '-', '\\', '-'];
      var currentStep = 0;

      progress = function() {
        var ret = steps[currentStep];
        currentStep = ( currentStep + 1 ) % steps.length;
        return ret;
      };
    }

    response
    .on( 'data', function( data ) {
      downloaded += data.length;

      process.stdout.clearLine();
      process.stdout.cursorTo( 0 );
      process.stdout.write( progress() );
    } )
    .pipe( file )
    .on( 'finish', function() {
      if ( filesize ) process.stdout.write( '\n' );
      else {
        process.stdout.clearLine();
        process.stdout.cursorTo( 0 );
      }

      cb();
    } );
  } );
};
