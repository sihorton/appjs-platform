/**
* log any uncaught exceptions to disk in case user is not running from console.
*/
process.on('uncaughtException',function(e) {
	require('fs').writeFile("error.log", e.message+"\n"+e.stack, function(err) {
		if(err) {
			console.log("error writing error log:",err);
		} else {
			console.log("uncaughtException:",e.stack);
		}
	}); 
});

var fs=require('fs')
	,path=require('path');

if (process.argv.length>2) {
	//use realpath to convert relative paths.
	var resolvedPath = path.resolve(process.argv[2]);
	fs.stat(resolvedPath, function(err, stat) {
		if(err) throw err;
		if (!err && stat.isDirectory()) {
			var app = module.exports = require('appjs');
			app.readPackageFile = function(filename,callback) {
				fs.readFile(path.resolve(resolvedPath,filename),callback);
			}
			console.log("passed a directory");
			appDir = resolvedPath;
			//serve application from folder.
			fs.readFile(appDir+'/app.js', function(err,data){
				if(err) {
					console.error("Could not open application file: %s", err);
					process.exit(1);
				}
				//this is a standard app.js application
				app.serveFilesFrom(appDir + '/content');
				//run it
				//process.chdir(appDir);
				var olddir = __dirname;
				__dirname = appDir;
				eval(data.toString());
				__dirname = olddir;
			});

			var app = module.exports = require('appjs');
			app.serveFilesFrom(process.argv[3] + '/content');
		}
		if (!err && stat.isFile()) {
			var app = module.exports = require('appjs');
			var appFile = resolvedPath;
			var appDir = appFile.substring(0,appFile.split("\\").join("/").lastIndexOf("/"));
			//serve application from packagedApp folder
			var app = require('appjs');
			var packagedApp = require('./packagedApp2.js');
			//serve files from the content/ directory.
			app.router.use(packagedApp(appFile));
			var AdmZip = require('adm-zip');
			var packagedApp2 = new AdmZip(appFile);
			//provide function to read package files.
			app.readPackageFile = function(file,callback) {
				packagedApp2.readFileAsync(file,function(buffer,err) {
					callback(err,buffer);
				});
			}
			if (packagedApp2.getEntry('app.js')) {
				//packagedApp2.readFileAsync('app.js',function(buffer,err) {
				var myAppDir = appDir;
				app.readPackageFile('app.js',function(err,buffer) {
					if(err) {
						console.error("Could not open application file: %s", err);
						process.exit(1);
					}
					//this is a standard app.js application
					//run it
					//process.chdir(appDir);
					var olddir = __dirname;
					__dirname = appDir;
					eval(buffer.toString());
					__dirname = olddir;
				});	
				
			}
			
		}
	});
	
} else {

	var app = module.exports = require('appjs');

	app.serveFilesFrom(__dirname + '/content');

	var window = app.createWindow({
	  width  : 640,
	  height : 460,
	  icons  : __dirname + '/content/icons'
	});

	window.on('create', function(){
	  console.log("Window Created");
	  window.frame.show();
	  window.frame.center();
	});

	window.on('ready', function(){
	  console.log("Window Ready");
	  window.require = require;
	  window.process = process;
	  window.module = module;

	  function F12(e){ return e.keyIdentifier === 'F12' }
	  function Command_Option_J(e){ return e.keyCode === 74 && e.metaKey && e.altKey }

	  window.addEventListener('keydown', function(e){
		if (F12(e) || Command_Option_J(e)) {
		  window.frame.openDevTools();
		}
	  });
	});

	window.on('close', function(){
	  console.log("Window Closed");
	});
}