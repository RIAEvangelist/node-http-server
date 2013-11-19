var http    = require('http'),
    url     = require('url'),
    path    = require('path'),
    fs      = require('fs'),
    conf    = require('../config/http.js').init();
    
http.createServer(
    requestRecieved
).listen(conf.port);

function serveFile(filename,exists,response) {
    if(!exists) {
        serve(
            response,
            '404 MIA',
            404
        );
        return;
    }
    
    var contentType = path.extname(filename).slice(1);
    
    //Only serve specified file types 
    if(!conf.contentType){
        serve(
            response,
            '415 File type not supported',
            415
        );
        return;
    }
    
    //Deny restricted file types 
    if(!conf.contentType[contentType]){
        serve(
            response,
            '415 File type not supported',
            415
        );
        return;
    }
    
    //Do not allow access to Dirs or restricted file types
    if (
        fs.statSync(filename).isDirectory() ||
        conf.restrictedType[contentType]
    ){
        serve(
            response,
            '403 Access Denied',
            403
        );
        return;
    }
    
    fs.readFile(
        filename, 
        'binary', 
        function(err, file) {
            if(err) {        
                serve(
                    response,
                    '500 '+err,
                    500
                );
                return;
            }
    
            var headers = {
                'Content-Type' : conf.contentType[contentType]
            }
            
            if(conf.server.noCache)
                headers['Cache-Control']='no-cache, no-store, must-revalidate';
            
            serve(
                response,
                file,
                200,
                headers,
                'binary'
            );
            return;
        }
    );
}

function serve(response,body,status,headers,encoding){
    //defaults to 200
    if(!status)
        status=200;
    
    //defaults to text/plain
    if(!headers)
        headers={
            'Content-type':'text/plain'
        }
    
   //defaults to utf8
    if(!encoding)
        encoding='utf8';
    
    response.writeHead(
        status, 
        headers
    );
    response.write(body,encoding);
    response.end();
    return;
}

function requestRecieved(request,response){
    var uri = url.parse(request.url).pathname;
    if (uri=='/')
        uri='/'+conf.server.index;
    
    var filename = path.join(
        conf.rootDIR, 
        uri
    );
    
    fs.exists(
        filename,
        function(exists){
            serveFile(filename,exists,response)
        }
    );
}