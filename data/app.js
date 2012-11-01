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
				handleDependancies(app,function(err,missing) {
					if (err) {
						console.log("there were errors installing required dependancies.");
					} else {
						if (missing.length==0) {
							console.log("dependancies satisfied");
						} else {
							console.log("dependancies installed ok.");
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
							
						} else {
							console.log("package file error: app.js not found.");
						}
						
					}
				});
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

function handleDependancies(app,callback) {
	app.readPackageFile('appInfo.json',function(err,buffer) {
		if(err) {
			console.error("Could not open application file: %s", err);
			process.exit(1);
		}
		var platformInfo = {};
		var appInfo = JSON.parse(buffer.toString());
		console.log(appInfo['appName']+" v"+appInfo['appVersion']+"."+appInfo['packageVer']+" dependancies:");
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
							if (platformInfo.deps[i]) {
								pDep = platformInfo.deps[i];
								if (upgradeNeeded(aDep.version,pDep.version)) {
									console.log("-"+aDep.name+" v"+aDep.version + " ("+pDep.version+")");
									missing.push(aDep);
								} else {
									console.log("+"+aDep.name+" v"+aDep.version);
								}
							} else {
								console.log("-"+aDep.name+" v"+aDep.version);
								missing.push(aDep);
							}
						}
					}
					if (missing.length==0) {
						callback(undefined,missing);
					} else {
						downloadModules(missing,appInfo,platformInfo,function(err,downloaded) {
							if (err) {
								//there was an error downloading the modules.
							}
							console.log("modules downloaded");
							console.log(platformInfo);
							console.log(downloaded);
							var updating = 0;
							for(var m=downloaded.length-1;m>-1;m--) {
								console.log(downloaded[m]);
								updating++;
								console.log(__dirname+"/node_modules/"+downloaded[m].name+"/package.json");
								fs.readFile(__dirname+"/node_modules/"+downloaded[m].name+"/package.json", 'utf8', function (err,data) {
									if (err) {
										console.log("module was downloaded and extracted, but failed to install properly",err);
									} else {
										var modPackageInfo = JSON.parse(data);
										  if (!platformInfo.deps[modPackageInfo.name]) platformInfo.deps[modPackageInfo.name] = {};
										  
										  platformInfo.deps[modPackageInfo.name].name = modPackageInfo.name;
										  platformInfo.deps[modPackageInfo.name].version = modPackageInfo.version;
										  if (!platformInfo.deps[modPackageInfo.name]['platforms']) platformInfo.deps[modPackageInfo.name].platforms = {};
										  platformInfo.deps[modPackageInfo.name].platforms[process.platform] = process.platform;
										  if (--updating<1) {
											//modules downloaded and platform info updated.
											fs.writeFile(__dirname+"/"+config.appInfoFile,JSON.stringify(platformInfo, null,4),function(err) {
												if (err) {
													console.log(err);
												} else {
													console.log("wrote platform config file");
													console.log(__dirname+"/"+config.appInfoFile);
													callback(undefined);
												}
											});
										  }
									}
								});
							}
						});
					}
				});
			}
		});

	});
}
function downloadModules(missing,appInfo,platformInfo,callback) {
	var req1 = appInfo.moduleUrl;
	var req2 = platformInfo.moduleUrl;
	if (config.preferOfficialModules) {
		req1 = platformInfo.moduleUrl;
		req2 = appInfo.moduleUrl;
	}
	//try to download module from offical sources first..
	console.log("download modules...");
	var downloading = 0;
	for(var i=missing.length-1;i>-1;i--) {
		var aDep = missing[i];
		downloading++;
		//console.log(aDep);
		var file = aDep.name+"-"+aDep.version+"-"+process.platform+config.modulePackageExt;
		getFile(__dirname+"/node_modules/"+file,req1+file,req2+file,aDep,function(err,file,aDep) {
			if (err) {
				console.log("callback error",err);
				return;
			}
			console.log("file downloaded",file);
			//file is downloaded try to detect if it is correct and unpack.
			try {
				var AdmZip = require('adm-zip');
				var module = new AdmZip(file);
				console.log("extracting to",__dirname+"/node_modules/"+aDep.name+"-test");
				module.extractAllTo(__dirname+"/node_modules/"+aDep.name+"-test", /*overwrite*/true);
				//extractAllTo is a synchronous operation!
				//update the platform module list if it appeared to work..
				if (--downloading<1) callback(undefined,missing);
			} catch(e) {
				console.log("module was downloaded but failed to unpack:",file);
			}
		});
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