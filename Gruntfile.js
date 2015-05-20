module.exports = function( grunt ) {
  grunt.loadNpmTasks( 'grunt-angular-gettext' );
  grunt.loadNpmTasks( 'grunt-ngdocs' );

  grunt.initConfig( {
    nggettext_extract: {
      pot: {
        files: {
          'app/languages/template.pot': ['app/index.html', 'app/views/**/*.html']
        }
      }
    },
    nggettext_compile: {
      all: {
        files: {
          'app/js/translations.js': ['app/languages/*.po']
        }
      }
    },
    ngdocs: {
      all: ['app/src/**/*.js'],
      options: {
        dest: 'docs'
      }
    }
  } );

  grunt.registerTask( 'default', ['nggettext_extract', 'nggettext_compile'] );
  grunt.registerTask( 'docs', ['ngdocs'] );
};
