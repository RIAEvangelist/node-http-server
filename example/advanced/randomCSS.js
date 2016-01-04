var os = require( 'os' );
var server=require('../../server/http.js');
var config=new server.Config;

config.verbose=false;
config.port=8000;
config.root=__dirname+'/appRoot/';
config.server.index='randomCSS.html';


server.beforeServe=beforeServe;

function beforeServe(request,response,body,encoding){
    //only parse css files
    if(response.getHeader('Content-Type')!=server.config.contentType.css){
        return;
    }

    var values={
        bgr:getRand(),
        bgg:getRand(),
        bgb:getRand(),
        tr:getRand(),
        tg:getRand(),
        tb:getRand(),
    }

    var vars=Object.keys(values);

    for(var i in vars){
        var reg=new RegExp(
            '\{\{'+vars[i]+'\}\}',
            'g'
        );

        body.value=body.value.replace(
            reg,
            values[
                vars[i]
            ]
        );
    }
}

function getRand(){
    return Math.round(
        Math.random()*255
    );
}

server.deploy(config);
