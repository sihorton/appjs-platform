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
	,moduleDir:__dirname+"/node_modules/"
}

var fs    = require('fs')
	,path = require('path')
	,http = require("http")
	,request = require('request')
	;
var appInfo = {
	name:'Unknown'
	,version:0
}
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
				handleDependancies(app,function(err,missing,failed) {
					if (err) {
						console.log("\n failed to install required dependancies");
					} else {
						if (missing.length==0) {
							console.log("\ndependancies satisfied\n");
						} else {
							console.log("\ndependancies installed ok.\n");
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
		appInfo = JSON.parse(buffer.toString());
		console.log("\nchecking dependancies:"+appInfo['appName']+" v"+appInfo['appVersion']+"."+appInfo['packageVer']);
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
									console.log("\t>"+aDep.name+" v"+aDep.version + " ("+pDep.version+")");
									missing.push(aDep);
								} else {
									console.log("\t+"+aDep.name+" v"+aDep.version);
								}
							} else {
								console.log("\t-"+aDep.name+" v"+aDep.version);
								missing.push(aDep);
							}
						}
					}
					if (missing.length==0) {
						callback(undefined,missing);
					} else {
						downloadModules(missing,appInfo,platformInfo,function(err,downloaded) {
							var downloadModulesErr = "";
							if (err) {
								//there was an error downloading the modules.
								downloadModulesErr = err;
							} else {
								//console.log("required modules downloaded");
							}
							var updating = 0;
							for(var m=downloaded.length-1;m>-1;m--) {
								updating++;
								fs.readFile(config.moduleDir+downloaded[m].name+"/package.json", 'utf8', function (err,data) {
									if (err) {
										console.log("\tinstall failed:",err);
									} else {
										var modPackageInfo = JSON.parse(data);
										  if (!platformInfo.deps[modPackageInfo.name]) platformInfo.deps[modPackageInfo.name] = {};
										  
										  platformInfo.deps[modPackageInfo.name].name = modPackageInfo.name;
										  platformInfo.deps[modPackageInfo.name].version = modPackageInfo.version;
										  if (!platformInfo.deps[modPackageInfo.name]['platforms']) platformInfo.deps[modPackageInfo.name].platforms = {};
										  platformInfo.deps[modPackageInfo.name].platforms[process.platform] = process.platform;
										console.log("\tinstalled:"+modPackageInfo.name);
										  if (--updating<1) {
											//modules downloaded and platform info updated.
											fs.writeFile(__dirname+"/"+config.appInfoFile+"2",JSON.stringify(platformInfo, null,4),function(err) {
												if (err) {
													callback(err,missing);
												} else {
													callback(downloadModulesErr,missing);
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
	console.log("\n"+missing.length+" required module(s) are missing, attempting to download and install.");
	var downloading = 0;
	var downloadingErrorText = "";
	for(var i=missing.length-1;i>-1;i--) {
		var aDep = missing[i];
		downloading++;
		//console.log(aDep);
		var file = aDep.name+"-"+aDep.version+"-"+process.platform+config.modulePackageExt;
		getModuleFile(file,req1+file,req2+file,aDep,function(err,file,aDep) {
			if (err) {
				console.log("\t"+err.message+":"+file);
				downloadingErrorText = "failed to install required packages";
			} else {
				console.log("\tdownloaded:",file);
				//file is downloaded try to detect if it is correct and unpack.
				try {
					var AdmZip = require('adm-zip');
					var module = new AdmZip(config.moduleDir+file);
					module.extractAllTo(config.moduleDir+aDep.name, /*overwrite*/true);
					console.log("\textracted:"+file);
					//extractAllTo is a synchronous operation!
					fs.unlink(config.moduleDir+file,function(err) {
						if (err) {
							console.log(err);
						}
					});
				} catch(e) {
					console.log("\t!failed to extract:"+file);
				}
			}
			if (--downloading<1) callback(downloadingErrorText,missing);
		});
	}
}
function getModuleFile(file,uri,fallbackUri,aDep,callback) {
	
	console.log("\t"+uri);
	var o = fs.createWriteStream(config.moduleDir+file);
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
	request(uri,function(error,response,body) {
		if (response.statusCode != 200) {
			//file is missing even if download was ok.
			o.cancel = true;
			o.destroy();
			callback(new Error(response.statusCode+' http error'),file,aDep);
		}
	})
	.on('error',function(err1) {
		o.cancel = true;
		o.destroy();
		fallback(file,uri,fallbackUri,aDep,callback);
		
	}).pipe(o);
	function fallback(file,uri,fallbackUri,aDep,callback) {
		var o2 = fs.createWriteStream(file);
		o2.on('error',function(err) {
			console.log("Error unable to write module file",err);
			callback(err,file,aDep);
		});
		o2.on('close',function(err) {
			callback(err,file,aDep);
		});
		console.log("\ttrying:"+fallbackUri);
		request(fallbackUri,function(error,response,body) {
			if (response.statusCode != 200) {
				//file is missing even if download was ok.
				o.cancel = true;
				o.destroy();
				fallback(file,uri,fallbackUri,aDep,callback);
			}
		})
		.on('error',function(err2) {
			console.log("error",err2.code);
			callback(err2,file,aDep);
		}).pipe(o2);
	}
	
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