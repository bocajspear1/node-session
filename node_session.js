
 
 
/*
 * Object <node_session_object>
 * 
 * Description: This is the main object for the session manager,
 * 				
 * 
 */

function node_session_object()
	{
		
		// Stores the type of the session, persistant or session
		this.type = '';
		
		// Stores the name of the cookie sent to the user
		this.name = 'sessionid';
		
		// Time in seconds the session should last
		this.session_expire_time = '';
		
		// Time in seconds the persistant session's cookie should last
		this.cookie_expire_time = '';
		
		// Setting for httponly in cookie, on by default
		this.http_only = ''
		
		this.secure_only = '';
		
		// Stores value for cookie path, default is '/'
		this.cookie_path = '/';

		// Stores value for cookie domain, default is blank
		this.cookie_domain = '';
		
		// By default, check by ip address to mitigate using cookies from elsewhere
		this.ip_matching = true;
		
		this.user_agent_matching = true;
		
		this.time_offsest = '';
		
		// The database connection
		this.mongoclient = require('mongodb').MongoClient;
		this.mongo_string = '';
		
		// Holds sessions that will be regenerated on next request
		this.to_stop = [];
		
		// Storage for functions
		
		// This function will be run on session removal, including ones that are not being directly removed manually
		this.on_session_destroy;
		
		// This function will be run when a session is created
		this.on_session_create;
		
		// This function will be run when a session is updated
		this.on_session_update;
		
		/* 
		 * Function: setup
		 * 
		 * Description: This function adds setup values for the session. See documentation for valid setting inputs.
		 * 
		 * 
		 * Input:
		 * 		values [Object]: Holds setting values
		 * 
		 * Output:
		 * 		None;
		 * 
		 *  
		 */
		 
		this.setup = setup;
		function setup(values)
			{
				// Get the connection string for database access
				if (values.connection_url)
					{
						this.mongo_string = values.connection_url;
					}else{
						throw new Error('No database connection string has been given');
					}
				
				// Check if there are can be an expire time for the session
				if (!values.expire_time&&!values.session_expire_time)
					{
						throw new Error('No expire time or session_expire_time has been given, required for session timeouts');
					}else{
						if (!values.session_expire_value)
							{
								this.session_expire_time = values.expire_time;
							}else{
								this.session_expire_time = values.session_expire_time;
							} 
					}
				
				// Setup for certain types of sessions
				if (values.type=='session')
					{
						this.type = 'session';
					}else if (values.type=='persistant'){
						this.type = 'persistant';
						
						// If there is no cookie expire value set, then default to just expire_time
						if (!values.cookie_expire_value)
							{
								this.cookie_expire_time = values.expire_time;
							}else{
								this.cookie_expire_time = values.cookie_expire_time;
							}
							
						
					}
				
				if (values.http_only)
					{
						if (values.http_only===true||values.http_only===false)
							{
								this.http_only = values.http_only;
							}else{
								throw new Error('Invalid entry for http_only, only takes true or false');
							}
						
					}
				
				if (values.secure_only)
					{
						if (values.secure_only===true||values.secure_only===false)
							{
								this.secure_only = values.secure_only;
							}else{
								throw new Error('Invalid entry for secure_only, only takes true or false');
							}
					}
				
				if (values.ip_matching)
					{
						if (values.ip_matching===true||values.ip_matching===false)
							{
								this.ip_matching = values.ip_matching;
							}else{
								throw new Error('Invalid entry for ip_matching, only takes true or false');
							}
					}
				
				// Setup function for when a session is destroyed
				if (values.on_session_destroy)
					{
						if (typeof(values.on_session_destroy) == "function") {
							this.on_session_destroy = values.on_session_destroy;
						}else{
							this.on_session_destroy = '';
						}
					}
				
				// Setup function for when a session is created
				if (values.on_session_create)
					{
						if (typeof(values.on_session_create) == "function") {
							this.on_session_create = values.on_session_create;
						}else{
							this.on_session_create = '';
						}
					}
					
				// Setup function for when a session is updated
				if (values.on_session_update)
					{
						if (typeof(values.on_session_update) == "function") {
							this.on_session_update = values.on_session_update;
						}else{
							this.on_session_update = '';
						}
					} 
				
				// Setup the storage method
				if (values.storage)
					{
						this.storage = values.storage;
						this.storage.on_save = this.on_session_update;
						this.storage.on_destroy = this.on_session_destroy;
					}else{
						throw new Error('No session storage defined');
					}
			}
		
	
		
		this.start = start;
		function start(request,response,next)
			{
				// Setup defaults
				this.set_request_blank(request)
				
				// Proxy end() so we can update session values at end
				var inner_end = response.end;
				var innerthis = this;
				response.end = function(data, encoding)
					{
						response.end = inner_end;
						if (!request.session)
							{
								request.session = {};
							}
							
						if (request.sessionid!='')
							{
								innerthis.save_session(request.sessionid,request.session,function(){
									response.end(data,encoding);
								});
							}else{
								response.end(data,encoding);
							}
						
						
					}
				
				// Call cleanup to remove old sessions
				this.cleanup();
				 
				// Check if there is a connection available
				if (this.mongo_string!='')
					{
						/*// Delete old sessions
						this.mongoclient.connect(this.mongo_string,function(err,db){
							if (!err)
								{
									var current_timestamp = new Date().getTime();
									console.log('current at remove: ' + current_timestamp);
									db.collection('node_sessions').find({expires: {$lte: current_timestamp}}).toArray(function(err, results){
										for(var i = 0;i < results.length;i++)
											{
												var result = results[i];
												innerthis.destroy_session(result.sessionid,function(){console.log('go')});
											}
										//console.log(results); // output all records
									});
									
								}else{
									
								}
						});*/
						
						var cookie_value;
						if (request.headers.cookie)
							{
								cookie_value = this.get_cookie(this.name, request.headers.cookie);
							}else{
								cookie_value = '';
							}
							
						if (cookie_value!='')
							{
								// We have the session
								console.log('session exists');

								var innerthis = this;
								
								// Get stored session data
								this.get_session(cookie_value,function(session){
									var current_timestamp = new Date().getTime();
									
									if (session.session_ipaddress != request.connection.remoteAddress && innerthis.ip_matching===true)
										{
											// Possible cookie hack!
											console.log('Access to session from incorrect IP address: should be ' + session.session_ipaddress + ', but is ' + request.connection.remoteAddress);
											
											innerthis.invalidate_cookie(innerthis.name,cookie_value,response);
											
											/*innerthis.destroy_session(cookie_value,function(){
												console.log('Emergency Cookie Removal Complete');
											});*/
										
											// Go on
											next(request,response);
										
										// Check if the session being accessed has expired or it is in a to be regenerated
										}else if (session.session_useragent != request.headers['user-agent'] && innerthis.user_agent_matching===true){
											
											// Possible cookie hack!
											console.log('Access to session from incorrect user agent: should be ' + session.session_useragent + ', but is ' + request.headers['user-agent']);
											
											innerthis.invalidate_cookie(innerthis.name,cookie_value,response);
											
											// Go on
											next(request,response);
											
										}else if (session.expires < current_timestamp || (innerthis.to_stop.indexOf(cookie_value)!= -1)){	
											
											innerthis.regenerate_session(cookie_value,request,response,function(sessionid,session){
												innerthis.request_setup(request,response,sessionid,session);
												
												// Go on
												next(request,response);
											});
											
											
										}else{
											// Add data to request
											innerthis.request_setup(request,response,cookie_value,session);
																				

											// Update Cookie
											innerthis.set_session_cookie(innerthis.name,cookie_value,response);
											
											// Go on
											next(request,response);
										}
									
									
									
									
								});
								
								
							}else{
								// Need a new session
								
								// Set blank session data
								
								this.new_session(request, response, function(sessionid, init_data){
									
									// Add data to request
									innerthis.request_setup(request,response,sessionid,init_data);
									// Set the cookie
									
									
									// Go on
									next(request,response);
								});
								
								
								
								
							}
						
							
							
					
							
					}else{
						throw new Error('No database connection string has been given');
					}
				
			}

		this.request_setup = request_setup;
		function request_setup(request,response,sessionid,session_data)
			{
				var innerthis = this
				
				request.session = session_data;
				request.sessionid = sessionid;
				request.session.destroy = destroy_local_function;
				function destroy_local_function(callback)
					{
						innerthis.destroy_session(request,callback);
					}
				request.session.regenerate = regenerate_local_function;
				function regenerate_local_function(callback)
					{
						innerthis.stop_session(request,response,callback);
					}	
				return request;
			}
		
		this.set_request_blank = set_request_blank;
		function set_request_blank(request)
			{
				request.session = {};
				request.sessionid = '';
				request.session.destroy = blank_function;
				request.session.regenerate = blank_function;
				function blank_function()
					{
						
					}
			}
		
		
		this.new_session = new_session;
		function new_session(request,response,callback)
			{
				var innerthis = this;
			
				
				this.new_session_id(function(sessionid){
					
						if (typeof(innerthis.on_session_create) == "function")
							{
									innerthis.on_session_create(sessionid);
							}
						
						var init_data = {session_ipaddress: request.connection.remoteAddress, session_useragent: request.headers['user-agent']};
						
						// Save blank session to database
						innerthis.save_session(sessionid,init_data,function(){
							
							innerthis.set_session_cookie(innerthis.name,sessionid,response);
							callback(sessionid,init_data);
							
						});
					
				});
			}
		
		this.regenerate_session = regenerate_session;
		function regenerate_session(sessionid,request,response,callback)
			{
				var innerthis = this;
				
				this.remove_cookie(this.name,response);
				if (sessionid)
					{
						this.destroy_session(sessionid,function(number){
							if (number!=0)
								{
									innerthis.new_session(request,response,callback);
								}else{
									
								}
						});
					}else{
						throw new Error('Call to regenerate session with no session defined');
					}
				
			}
		
		this.destroy_session = destroy_session;
		function destroy_session(request,callback)
			{
				var sessionid;
				if (typeof request === 'object')
					{
						sessionid = request.sessionid;
						console.log('starting the destruction of session' + sessionid);
						
						
						// Destroy any local stuff
						this.set_request_blank(request)
						function blank_function()
							{
								
							}
					}else{
						sessionid=request;
					}
					
				var innerthis = this;
				
				
				if (this.mongo_string)
					{
						this.mongoclient.connect(this.mongo_string,function(err,db){
							if (!err)
								{
									if (typeof(innerthis.on_session_destroy) == "function")
											{
												var session_data = innerthis.get_session(sessionid,function(session){
													
													innerthis.on_session_destroy(sessionid,session_data)
												});
												
											}
									
									
									
									db.collection('node_sessions').remove({sessionid: sessionid},{safe: true}, function(err, records){
											console.log(records + " removed");
											
											
											callback(records);
										}); 
								}else{
									
								}
						});
					}else{
							console.log('no mongodb string')
					}
				
			}
		
		
		
		this.remove_cookie = remove_cookie;
		function remove_cookie(key,response)
			{
				// Get the current headers for Get-Cookie
				var cookies = response.getHeader('Set-Cookie');
				
				// Check if it even exists
				if (typeof cookies == 'undefined' || cookies=='')
					{

						
					
					// Check if there is already more than one cookie being set
					}else if (cookies instanceof Array){
						
						for(var i = 0;i<cookies.length;i++)
							{
								if (cookies[i].indexOf(key + "=")!=-1)
									{
										cookies[i] = '';
									}
							}
						
						response.setHeader("Set-Cookie", cookies);
					
					// Check if there is only one cookie
					}else{
						
						// Turn into array and then set the header
						if (cookies.indexOf(key + "=")!=-1)
							{
								response.setHeader("Set-Cookie", '');
							}
						
					}
			}
		
		this.set_session_cookie = set_session_cookie;
		function set_session_cookie(key,value,response)
			{
				// We do not have the session, make one
				if (this.type=='persistant')
					{
						this.new_cookie({
							key: key,
							value: value,
							path: this.cookie_path ,
							domain: this.cookie_domain,
							expire_time: this.cookie_expire_time
						}, response);
					}else{
						this.new_cookie({
							key: key,
							value: value,
							path: this.cookie_path,
							domain: this.cookie_domain
						}, response);
					}
			}
		
		this.invalidate_cookie = invalidate_cookie
		function invalidate_cookie(key,value,response)
			{
				this.new_cookie({
					key: key,
					value: 'invalid',
					path: '/',
					domain: "",
					expire_time: 'expire_now'
				}, response);
			}
			
		this.new_cookie = new_cookie;
		function new_cookie(values, response)
			{
				var cookie_string = '';
				
				// Add the key and its value
				if (values.key&&values.value)
					{
						cookie_string += values.key + '=' + encodeURIComponent(values.value) + '; ';
					}else{
						console.log('no key')
						return;
					}
				
				if (values.path)
					{
						cookie_string += 'Path=' + values.path + '; ';
					}else{
						cookie_string += 'Path=/; ';
					}
				
				if (values.domain)
					{
						cookie_string += 'Domain=' + values.domain + '; ';
					}else{
						//cookie_string += 'Domain=localhost; ';
					}
				
				if(values.expire_time&&values.expire_time!='expire_now')
					{
						var max_age = values.expire_time;
						var expires = add_seconds(new Date(Date.now()),max_age).toUTCString();
						
						
						cookie_string += 'Expires=' + expires + '; Max-Age=' + max_age + "; " ;
					}else if (values.expire_time=='expire_now'){
						cookie_string += 'Expires=Thu, 01 Jan 1970 00:00:01 GMT';
					}
				
				
				if (this.secure_only==true)
					{
						cookie_string += "Secure; ";
					}else if (this.secure_only===false){
						cookie_string += "";
					}else{
						// Detect if this is a https server
					}
				
				if (this.http_only==true)
					{
						cookie_string += "HttpOnly; ";
					}else if (this.http_only===false){
						cookie_string += "";
					}else{
						cookie_string += "HttpOnly; ";
					}
				
				//console.log(cookie_string);
				this.add_cookie(cookie_string,response);
				

			}
			
		this.get_cookie = get_cookie;
		function get_cookie(key, cookie)
			{
				if (cookie)
					{
						//console.log(cookie);
						var s_cookie = cookie.split(';');
						
						var cookie_value = '';
						
						for(var i = 0;i < s_cookie.length;i++)
							{
								var parts = s_cookie[i].split('=');
								if (parts[0].trim()==key)
									{
										cookie_value = decodeURIComponent((parts[1] || '').trim());
									}
							}
						
						return cookie_value;	
					}else{
						return false;
					}
						
				
			}
		
		this.add_cookie = add_cookie;
		function add_cookie(cookie_string,response)
			{
				// Get the current headers for Get-Cookie
				var cookies = response.getHeader('Set-Cookie');
				
				// Check if it even exists
				if (typeof cookies == 'undefined' || cookies=='')
					{

						response.setHeader("Set-Cookie", cookie_string);
					
					// Check if there is already more than one cookie being set
					}else if (cookies instanceof Array){
						
						// Just push the new cookie on the array of others and then set
						cookies.push(cookie_string);
						
						response.setHeader("Set-Cookie", cookies);
						
						
					
					// Check if this is the second cookie to be added
					}else{
						
						// Turn into array and then set the header
						var cookie_array = [cookie_string, cookies];
						response.setHeader("Set-Cookie", cookie_array);
					}
			}
			
		this.add_seconds = add_seconds;
		function add_seconds(date, seconds) {
			return new Date(date.getTime() + seconds*1000);
		}
	
	
		this.new_session_id = new_session_id;
		function new_session_id(callback)
			{
				// Generate session id
				var sessionid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(4) + Math.random().toString(36).slice(2);
				
				var innerthis = this;
				this.check_session_id(sessionid,function(result){
					if (result==true)
						{
							callback(sessionid);
						}else{
							innerthis.new_session_id(callback)
						}
				});
				
			}
		
		this.cleanup = cleanup;
		function cleanup()
			{
				this.storage.cleanup();
			}
		
		
		this.stop_session = stop_session
		function stop_session(request,response,callback)
			{
				var sessionid = request.sessionid;
				console.log("stop " + sessionid);
				
				this.to_stop.push(sessionid);
			}
		
		this.check_session_id = check_session_id;
		function check_session_id(sessionid,callback)
			{
				this.mongoclient.connect(this.mongo_string,function(err,db){
					
					if (err)
						{
							throw new Error('Error in connecting to database');
						}
					
					db.collection('node_sessions').findOne({sessionid: sessionid}, function(err, session){
						if (session)
							{
								console.log(sessionid + ' already exists')
								callback(false);
							}else{
								callback(true);
							}
					});
						
				});
			}
	
		this.get_session = get_session;
		function get_session(sessionid,callback)
			{
				this.mongoclient.connect(this.mongo_string,function(err,db){
					db.collection('node_sessions').findOne({sessionid: sessionid}, function(err,session){
						if (session)
							{
								callback(JSON.parse(session.data))
							}else{
								console.log('Got nothing on session');
								callback({});
							}
					}); 
				
				
				});	
			}
		
		this.save_session = save_session;
		function save_session(sessionid,data,callback)
			{
				this.storage.save_session(sessionid,data,callback);
				
				/*var innerthis = this;
				
				this.mongoclient.connect(this.mongo_string,function(err,db){
					
					db.collection('node_sessions').findOne({sessionid: sessionid}, function(err,session){
						var base_timestamp = new Date().getTime();
					
					
						var timestamp = base_timestamp + (innerthis.session_expire_time * 1000);
						
					
						
						
						var serialized_data = JSON.stringify(data);
						console.log(serialized_data);
						if (typeof(innerthis.on_session_update) == "function")
							{
								innerthis.on_session_update(sessionid,serialized_data)
							}
						
						if (session)
							{
								console.log('updating Session ' + sessionid);
								db.collection('node_sessions').save({_id: session._id,sessionid: sessionid, data: serialized_data, expires: timestamp}, {safe: true}, function(err, records){
									
									callback();
									
								});
							}else{
								console.log('inserting Session ' + sessionid);
								db.collection('node_sessions').save({sessionid: sessionid, data: serialized_data, expires: timestamp}, {safe: true}, function(err, records){
									
									callback();
									
								});
							}
					});
					
					
					
				});*/
			}
	}



module.exports = {
	session: node_session_object,
}


