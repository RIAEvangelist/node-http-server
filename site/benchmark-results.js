'use strict';

const benchmarkStatus=document.querySelector('#benchmark-status'),
    benchmarkResult=document.querySelector('#benchmark-result'),
    environmentBody=document.querySelector('#benchmark-environment'),
    scenariosBody=document.querySelector('#benchmark-scenarios');

if(benchmarkStatus && benchmarkResult && environmentBody && scenariosBody){
    fetch('./benchmarks/latest.json',{cache:'no-cache'})
        .then(function(response){
            if(!response.ok){
                throw new Error('Benchmark result returned HTTP '+response.status+'.');
            }
            return response.json();
        })
        .then(renderBenchmark)
        .catch(function(){
            benchmarkStatus.textContent='The published CI measurement is currently unavailable in this view. Run npm run benchmark for a local measurement.';
        });
}

function renderBenchmark(output){
    requireResult(output);

    const environment=output.environment,
        configuration=output.configuration;

    environmentBody.replaceChildren(row([
        dateValue(output.generatedAt),
        output.version,
        environment.node,
        environment.platform+' '+environment.architecture,
        configuration.requestsPerScenario,
        configuration.warmupRequestsPerScenario,
        configuration.concurrency
    ]));

    scenariosBody.replaceChildren(...output.scenarios.map(function(scenario){
        const latency=scenario.latencyMilliseconds;

        return row([
            scenario.label+' ('+scenario.id+')',
            scenario.requests,
            numberValue(scenario.requestsPerSecond),
            numberValue(latency.p50),
            numberValue(latency.p95),
            numberValue(latency.p99)
        ]);
    }));

    benchmarkStatus.textContent='Canonical '+environment.platform+' '+environment.node+' result loaded from CI.';
    benchmarkResult.hidden=false;
}

function requireResult(output){
    if(!output || output.benchmark!=='node-http-server' ||
        !output.environment || !output.configuration ||
        !Array.isArray(output.scenarios) || !output.scenarios.length){
        throw new Error('Benchmark result has an invalid structure.');
    }
}

function row(values){
    const output=document.createElement('tr');

    for(const value of values){
        const cell=document.createElement('td');
        cell.textContent=String(value);
        output.append(cell);
    }

    return output;
}

function numberValue(value){
    const number=Number(value);
    return Number.isFinite(number) ? number.toFixed(3) : 'unavailable';
}

function dateValue(value){
    const date=new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
