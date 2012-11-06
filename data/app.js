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


var fs    = require('fs')
	,path = require('path')
	//,http = require("http")
	//,request = require('request')
	;

if (process.argv.length>2) {
	var appPackage = require('appjs-package');
	appPackage.getPackageInfo(process.argv[2],function(err,pInfo) {
		if (err) throw err;
		var app = module.exports = require('appjs');
		if (pInfo.isPackage) {
			//serve files from the content/ directory.
			app.router.use(pInfo.router);
			pInfo.readPackageFile('app.js',function(err,buffer) {
				if (err) {
					console.error("Error opening app.js package file: %s", err);
					process.exit(1);
				}
				var olddir = __dirname;
				__dirname = path.dirname(pInfo.path);
				eval(buffer.toString());
				__dirname = olddir;
			});
		} else {
			app.serveFilesFrom(__dirname + '/content');
//app.router.use(require('./packagedApp.js')(__dirname + '/example.appjs'));

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
	});
} else {
app.serveFilesFrom(__dirname + '/content');
//app.router.use(require('./packagedApp.js')(__dirname + '/example.appjs'));

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


var app = module.exports = require('appjs');


