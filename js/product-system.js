// 产品系统页面只使用本地静态数据，避免依赖正式站后台。
(function(){
  function initProductSystem(){
    var detailButtons=document.querySelectorAll('[data-ps-detail]');
    var detailImage=document.getElementById('psDetailImage');
    var detailCaption=document.getElementById('psDetailCaption');
    detailButtons.forEach(function(button){
      button.addEventListener('click',function(){
        detailButtons.forEach(function(item){item.classList.remove('active');});
        button.classList.add('active');
        if(detailImage){detailImage.src=button.dataset.image;detailImage.alt=button.dataset.title;}
        if(detailCaption){detailCaption.textContent=button.dataset.description;}
      });
    });

    var orderButtons=document.querySelectorAll('[data-ps-order]');
    var orderImage=document.getElementById('psOrderImage');
    orderButtons.forEach(function(button){
      button.addEventListener('click',function(){
        orderButtons.forEach(function(item){item.classList.remove('active');});
        button.classList.add('active');
        if(orderImage){orderImage.src=button.dataset.image;orderImage.alt=button.dataset.title;}
      });
    });

    var qrButton=document.getElementById('psDealerQrButton');
    var qrPanel=document.getElementById('psDealerQr');
    if(qrButton&&qrPanel){qrButton.addEventListener('click',function(){qrPanel.classList.toggle('show');});}
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initProductSystem);}else{initProductSystem();}
})();
