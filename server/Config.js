/**************************************\
 *    Config Class.
 * ************************************/

function Config(userConfig){
    //for backwards compatibility
    var config = {};
    Object.defineProperties(
        config,
        {
            verbose     : {
                value:defaultConfigs.verbose,
                enumerable:true,
                writable:true
            },
            port        : {
                value:defaultConfigs.port,
                enumerable:true,
                writable:true
            },
            root        : {
                value:defaultConfigs.root,
                enumerable:true,
                writable:true
            },
            domain      : {
                value:defaultConfigs.domain,
                enumerable:true,
                writable:true
            },
            log         : {
                value:defaultConfigs.log,
                enumerable:true,
                writable:true
            },
            //pass this as config for custom logging
            logFunction : {
                value:defaultConfigs.logFunction,
                enumerable:true,
                writable:true
            },
            domains     : {
                value:defaultConfigs.domains,
                enumerable:true,
                writable:true
            },
            server      : {
                value:defaultConfigs.server,
                enumerable:true,
                writable:true
            },
            contentType : {
                value:defaultConfigs.contentType,
                enumerable:true,
                writable:true
            },
            restrictedType: {
                value:defaultConfigs.restrictedType,
                enumerable:true,
                writable:true
            },
            errors      : {
                value:defaultConfigs.errors,
                enumerable:true,
                writable:true
            }
        }
    )

    if(userConfig){
        for(var k in userConfig){
            config[k]=userConfig[k];
        }
    }

    //this is to allow backwards compatibility with configTemplate
    return config;
}

module.exports=Config;
