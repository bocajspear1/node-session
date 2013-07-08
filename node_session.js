
 
 
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
		this.http_only = '';
		
		// Setting for Secure in cookie, off by default
		this.secure_only = '';
		
		// Stores value for cookie path, default is '/'
		this.cookie_path = '/';

		// Stores value for cookie domain, default is blank
		this.cookie_domain = '';
		
		//  Indicates if we should check by ip address to mitigate using cookies sent from other devices. may break stuff that will attempt access through multiple IP addresses
		this.ip_matching = true;
		
		// Indicates of we should check by matching the user agent to mitigate cookie being used from locations other than the original user
		this.user_agent_matching = true;
				
		// Holds sessions that will be regenerated on next request
		this.to_stop = [];
		
		
		/*
		 * This area holds the on... functions which will be run on their respective events
		 */
		
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
				
				// Check if this is being set up as middleware, which will call next() instead of next(request,reponse)
				if (values.is_middleware)
					{
						this.is_middleware = values.is_middleware;
					} 
				
				if (values.name)
					{
						this.name = values.name;
					}
				
				if (values.cookie_path)
					{
						this.cookie_path = values.cookie_path;
					} 
					
				if (values.cookie_domain)
					{
						this.cookie_domain = values.cookie_domain;
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
					}else if (values.type=='persistent'){
						this.type = 'persistent';
						
						// If there is no cookie expire value set, then default to just expire_time
						if (!values.cookie_expire_value)
							{
								this.cookie_expire_time = values.expire_time;
							}else{
								this.cookie_expire_time = values.cookie_expire_time;
							}
							
						
					}else{
						throw new Error('Invalid entry for session type');
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
				
				if (values.user_agent_matching)
					{
						if (values.user_agent_matching===true||values.user_agent_matching===false)
							{
								this.user_agent_matching = values.user_agent_matching;
							}else{
								throw new Error('Invalid entry for user_agent_matching, only takes true or false');
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
						this.storage.session_expire_time = this.session_expire_time;
					}else{
						throw new Error('No session storage defined');
					}
			}
		

		/* 
		 * Function: start
		 * 
		 * Description: This is where the magic happens. This function is the main function of the session manager.
		 * 
		 * 
		 * Input:
		 * 		request: The node.js request object
		 * 		response: The node.js response object
		 * 		next: A callback function
		 * 
		 * Output:
		 * 		None;
		 * 
		 *  
		 */
		this.start = start;
		function start(request,response,next)
			{
				// Setup defaults
				

				this.set_request_blank(request);
				
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
				
									
					var cookie_value;
					if (request.headers.cookie)
						{
							cookie_value = this.get_cookie(this.name, request.headers.cookie);
						}else{
							cookie_value = '';
						}
						
					if (cookie_value!='')
						{

							var innerthis = this;
							
							// Get stored session data
							this.get_session(cookie_value,function(full_session){
								
								if (full_session)
									{
										var session = full_session.data;
										
										var current_timestamp = new Date().getTime();
										
										// Check if IP addresses match
										if (session.session_ipaddress != request.connection.remoteAddress && innerthis.ip_matching===true)
											{
												// Possible cookie hack!
												console.log('Access to session from incorrect IP address: should be ' + session.session_ipaddress + ', but is ' + request.connection.remoteAddress);
												
												innerthis.invalidate_cookie(innerthis.name,cookie_value,response);
												
												// Go on
												if (innerthis.is_middleware===true)
													{
														next();
													}else{
														next(request,response);
													}
											
											
											}else if (session.session_useragent != request.headers['user-agent'] && innerthis.user_agent_matching===true){
												
												// Possible cookie hack!
												console.log('Access to session from incorrect user agent: should be ' + session.session_useragent + ', but is ' + request.headers['user-agent']);
												
												innerthis.invalidate_cookie(innerthis.name,cookie_value,response);
												
												// Go on
												if (innerthis.is_middleware===true)
													{
														next();
													}else{
														next(request,response);
													}
													
												
											// Check if the session being accessed has expired or it is in a to be regenerated	
											}else if (session.expires < current_timestamp || (innerthis.to_stop.indexOf(cookie_value)!= -1)){	
												
												console.log('Expired');
												
												innerthis.regenerate_session(cookie_value,request,response,function(sessionid,session){
													
												// Go on
												if (innerthis.is_middleware===true)
													{
														next();
													}else{
														next(request,response);
													}
												});
												
												
											}else{
												// Add data to request
												innerthis.set_request_data(request,response,cookie_value,session);
																					

												// Update Cookie
												innerthis.set_session_cookie(innerthis.name,cookie_value,response);
												
												// Go on
												if (innerthis.is_middleware===true)
													{
														next();
													}else{
														next(request,response);
													}
											}
									}else{
										// Need a new session
							
										// Set blank session data
										
										innerthis.new_session(request, response, function(sessionid, init_data){
												// Go on
												if (innerthis.is_middleware===true)
													{
														next();
													}else{
														next(request,response);
													}
										});
									}
							});
						}else{
							// Need a new session
							this.new_session(request, response, function(sessionid, init_data){
								if (innerthis.is_middleware===true)
									{
										next();
									}else{
										next(request,response);
									}
							});
						}
						
							
							
					
							
					
				
			}
		
		this.set_request_data = set_request_data;
		function set_request_data(request,response,sessionid,session_data)
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
					
						// If the in_session_create function is defined, call it
						if (typeof(innerthis.on_session_create) == "function")
							{
									innerthis.on_session_create(sessionid);
							}
						
						// Create init data, which consists of the accessing device's IP address and user agent, used for security functionality
						var init_data = {session_ipaddress: request.connection.remoteAddress, session_useragent: request.headers['user-agent']};
						
						// Save new session to database
						innerthis.save_session(sessionid,init_data,function(){
							
							// Set the session cookie
							innerthis.set_session_cookie(innerthis.name,sessionid,response);
							
							// Set the data to the request object
							innerthis.set_request_data(request,response,sessionid,init_data);
							
							// Execute the callback
							callback(sessionid,init_data);
							
						});
					
				});
			}
		
		/* 
		 * Function: regenerate_session
		 * 
		 * Description: This function deletes the current session given by sessionid and creates a new one
		 * 
		 * 
		 * Input:
		 * 		
		 * 
		 * Output:
		 * 		None;
		 * 
		 *  
		 */
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
				
				
				this.storage.destroy_session(sessionid,callback);
				
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
				
				this.to_stop.push(sessionid);
			}
		
		this.check_session_id = check_session_id;
		function check_session_id(sessionid,callback)
			{
				this.get_session(sessionid,function(session){
					if (session)
						{
							callback(false);
						}else{
							callback(true);
						}
				});

			}
	
		this.get_session = get_session;
		function get_session(sessionid,callback)
			{
				this.storage.get_session(sessionid,callback);
			}
		
		this.save_session = save_session;
		function save_session(sessionid,data,callback)
			{
				this.storage.save_session(sessionid,data,callback);
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
						
						var now_date = new Date(Date.now());
						var expires = new Date(now_date.getTime() + max_age*1000).toUTCString();
						
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
			

	
		
	}

var session_middleware_config = '';

module.exports = {
	session: node_session_object,
	session_middleware: function(request,response,next){
		var new_session = new node_session_object();
		new_session.setup(session_middleware_config);
		
		new_session.start(request,response,next);
	},
	middleware_config: function(values){
		values.is_middleware = true;
		session_middleware_config = values;
	}
}


