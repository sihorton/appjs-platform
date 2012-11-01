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

var config = {
	packageExt:'.appjs'
	,modulePackageExt:'.modpack'
	,appInfoFile:'appInfo.json'
	,preferOfficialModules:true
}

var fs    = require('fs')
	,path = require('path')
	,http = require("http")
	,request = require('request')
	;

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
			var packagedApp = require('appjs-packagedApp');
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
			if (packagedApp2.getEntry('appInfo.json')) {
				//this package defines what dependancies it requires.
				handleDependancies(app);
			} else {
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

function handleDependancies(app) {
	app.readPackageFile('appInfo.json',function(err,buffer) {
		if(err) {
			console.error("Could not open application file: %s", err);
			process.exit(1);
		}
		var platformInfo = {};
		var appInfo = JSON.parse(buffer.toString());
		console.log("dependancy info found for "+appInfo['appName']+" v"+appInfo['appVersion']+"."+appInfo['packageVer']);
		//read platform dependancies...
		fs.exists(__dirname+"/"+config.appInfoFile,function(exists) {
			if (!exists) {
				//no local dependancies...
				console.log("no local dependancies found.");
			} else {
				fs.readFile(__dirname+"/"+config.appInfoFile, 'utf8', function (err,data) {
				  if (err) {
					console.log(err);
				  } else {
					platformInfo = JSON.parse(data);
					//perform a comparison.
					var missing = [];
					for(var i in appInfo.deps) {
							var aDep = appInfo.deps[i];
							console.log("app requires:"+aDep.name+" v"+aDep.version);
							if (platformInfo.deps[i]) {
								pDep = platformInfo.deps[i];
								if (upgradeNeeded(aDep.version,pDep.version)) {					
									
											missing.push(aDep);
								} else {
										console.log("OK: app wanted "+aDep.name+" v"+aDep.version + " we have "+pDep.version);
								}
							} else {
								console.log("MISSING");
								missing.push(aDep);
							}
						}
					}
					if (missing.length>0) {
						downloadModules(missing,appInfo,platformInfo);
					}
				});
			}
		});

	});
}
function downloadModules(missing,appInfo,platformInfo) {
	var req1 = appInfo.moduleUrl;
	var req2 = platformInfo.moduleUrl;
	if (config.preferOfficialModules) {
		req1 = platformInfo.moduleUrl;
		req2 = appInfo.moduleUrl;
	}
	//try to download module from offical sources first..
	console.log("download modules...");
	
	for(var i=missing.length-1;i>-1;i--) {
		var aDep = missing[i];
		//console.log(aDep);
		var file = aDep.name+"-"+aDep.version+"-"+process.platform+config.modulePackageExt;
		getFile(__dirname+"/node_modules/"+file,req1+file,req2+file,aDep,function(err,file,aDep) {
			if (err) {
				console.log("callback error",err);
				return;
			}
			console.log("file downloaded",file);
			console.log(aDep);
			//file is downloaded try to detect if it is correct and unpack.
			try {
				var AdmZip = require('adm-zip');
				var module = new AdmZip(file);
				module.extractAllTo(__dirname+"/node_modules/"+aDep.name, /*overwrite*/true);
			} catch(e) {
				console.log("module was downloaded but failed to unpack:",file);
			}
		});
		/*var o = fs.createWriteStream(__dirname+"/node_modules/"+file);
		o.on('error',function(err) {
			console.log("Error unable to write module file",err);
		});
		console.log(req1+file);
		request(req1+file)
			.on('error',function(err1) {
				console.log("unable to download from url",err1.code);
				//attempt to download using the app url instead.
				var o2 = fs.createWriteStream(__dirname+"/node_modules/"+file);
				o2.on('error',function(err) {
					console.log("Error unable to write module file",err);
				});
				console.log(req2+file);
				request(req2+file)
					.on('error',function(err2) {
						console.log("unable to download from",req1+file,err1.code);
						console.log("unable to download from",req2+file,err2.code);
					}).pipe(o2);
			}).pipe(o);
		
		*/
	}
}
function getFile(file,uri,fallbackUri,aDep,callback) {
	
	var o = fs.createWriteStream(file);
	o.cancel = false;
	o.on('error',function(err) {
		console.log("Error unable to write module file",err);
		callback(err,file,aDep);
	});
	o.on('close',function(err) {
		if (!this.cancel) {
			console.log("file written",this.cancel);
			callback(err,file,aDep);
		}
	});
	console.log(uri);
	request(uri)
	.on('error',function(err1) {
		o.cancel = true;
		o.destroy();
		var o2 = fs.createWriteStream(file);
		o2.on('error',function(err) {
			console.log("file error",err);
			callback(err,file,aDep);
		});
		o2.on('close',function(err) {
			console.log("file written");
			callback(err,file,aDep);
		});
		console.log(fallbackUri);
		request(fallbackUri)
		.on('error',function(err2) {
			console.log("error",err2.code);
			callback(err2,file,aDep);
		}).pipe(o2);
	}).pipe(o);
}
/**
* Compare requested version number against installed version number
* and return true if an upgrade is needed.
* UpgradeNeeded("0.3.2345.5","0.3")=>true
* UpgradeNeeded("0.3.2345.5","0.3.2345")=>true
* UpgradeNeeded("0.3.2345.5","0.3.2345.5")=>false
* UpgradeNeeded("0.3.2345.5","0.4")=>false
*/
function upgradeNeeded(requested,installed) {
	var req = requested.split(".");
	var got = installed.split(".");
	var diff = req.length - got.length;
	if (diff > 0) {
		for(var i = diff;diff>0;diff--) {
			got.push(0);
		}
	} else {
		for(var i = diff;diff<0;diff++) {
			req.push(0);
		}
	}
	for(var p=0;p<req.length;p++) {
		var r = parseFloat(req[p]);
		var g = parseFloat(got[p]);
		if (r > g) return true;
		if (r < g) return false;
		//if equal compare next figure
	}
	return false;
}