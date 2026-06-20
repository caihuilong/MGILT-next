// 产品系统页面只使用本地静态数据，避免依赖正式站后台。
(function(){
  function initProductSystem(){
    document.querySelectorAll('#page-system .ps-group').forEach(function(group){
      var grid=group.querySelector('.ps-grid');
      if(!grid||group.querySelector('.ps-module-arrows'))return;
      var controls=document.createElement('div');
      controls.className='ps-module-arrows';
      controls.innerHTML='<button type="button" class="ps-module-arrow ps-module-prev" aria-label="上一组模块">‹</button><button type="button" class="ps-module-arrow ps-module-next" aria-label="下一组模块">›</button>';
      group.insertBefore(controls,grid);
      var prev=controls.querySelector('.ps-module-prev');
      var next=controls.querySelector('.ps-module-next');
      function update(){var max=grid.scrollWidth-grid.clientWidth;prev.disabled=grid.scrollLeft<4;next.disabled=grid.scrollLeft>max-4||max<4;}
      prev.addEventListener('click',function(){grid.scrollBy({left:-grid.clientWidth*.82,behavior:'smooth'});});
      next.addEventListener('click',function(){grid.scrollBy({left:grid.clientWidth*.82,behavior:'smooth'});});
      grid.addEventListener('scroll',update,{passive:true});
      window.addEventListener('resize',update);
      requestAnimationFrame(update);
    });

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
