'use strict';

async function copyText(value,button){
    const original=button.textContent;

    try{
        await navigator.clipboard.writeText(value);
        button.textContent='Copied';
    }catch(error){
        const textarea=document.createElement('textarea');
        textarea.value=value;
        textarea.setAttribute('readonly','');
        textarea.style.position='fixed';
        textarea.style.opacity='0';
        document.body.append(textarea);
        textarea.select();

        try{
            document.execCommand('copy');
            button.textContent='Copied';
        }catch(copyError){
            button.textContent='Select + copy';
        }

        textarea.remove();
    }

    setTimeout(function(){
        button.textContent=original;
    },1400);
}

for(const button of document.querySelectorAll('[data-copy-text]')){
    button.addEventListener('click',function(){
        copyText(button.dataset.copyText,button);
    });
}

for(const button of document.querySelectorAll('[data-copy-target]')){
    const target=document.getElementById(button.dataset.copyTarget);

    if(target){
        button.addEventListener('click',function(){
            copyText(target.textContent,button);
        });
    }
}

const year=document.querySelector('[data-year]');

if(year){
    year.textContent=new Date().getFullYear();
}

function openLinkedDetails(){
    if(!window.location.hash){
        return;
    }

    let id;
    try{
        id=decodeURIComponent(window.location.hash.slice(1));
    }catch(error){
        return;
    }

    const target=document.getElementById(id);
    if(target?.tagName==='DETAILS'){
        target.open=true;
    }
}

window.addEventListener('hashchange',openLinkedDetails);
openLinkedDetails();
