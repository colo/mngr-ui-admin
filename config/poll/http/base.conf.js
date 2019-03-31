const path = require("path");

module.exports = {
	
	requests : {
		once: [],
		periodical: [],
		range: [],
		//monitor: [],
		//config: [],
	},
	
	id: '',
	path: '',
	
	logs: null,
	
	jar: true,
	
	/*authentication: {
		username: 'lbueno',
		password: '123',
		sendImmediately: true,
	},*/
	
	authentication: {
		username: 'anonymous',
		password: '',
		sendImmediately: false,
	},
	
	//authorization: {
		//config: path.join(__dirname,'../../rbac.json'),
	//},
	
	api: {
		version: '1.0.0',
	
		routes: {
			get: [
				{
				path: '',
				callbacks: ['get'],
				version: '',
				},
			]
		},
	},
};
