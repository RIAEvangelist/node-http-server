var os = require( 'os' );
var server=require('../../server/http.js');
var config=new server.Config;

config.verbose=false;
config.port=8000;
config.root=__dirname+'/appRoot/';
config.server.noCache=true;
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;

server.onRequest=startTimer;
server.beforeServe=beforeServe;
server.afterServe=stopTimer;

var benchmarks=[];

function startTimer(request,response){
    var index=benchmarks.length;
    benchmarks[index]={
        startTime:new Date().getMilliseconds(),
        file:request.url
    }

    request.myBenchmarkIndex=index;
}

function stopTimer(request){
    var index=benchmarks.length;
    benchmarks[request.myBenchmarkIndex].endTime=new Date().getMilliseconds();
}

function beforeServe(request,response,body,encoding){
    //only parse the /index.html request
    if(request.url!='/index.html'){
        return;
    }

    //dynamically detect available interfaces
    var content='<li>refresh to get more benchmark times</li><li>';
    for(var i in benchmarks){
        var benchmark=benchmarks[i];
        if(!benchmark.endTime){
            continue;
        }
        content+='<li>'+benchmark.file+' : <strong>'+(benchmark.endTime-benchmark.startTime)+'ms</strong></li>';
    }

    body.value=body.value.replace('{{some-content}}',content);
}

server.deploy(config);
