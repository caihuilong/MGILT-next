// 正式站首页交互的本地静态实现。
(function(){
  var whyItems=[
    ['模块一上场，空间就开场','告别死板非标定制，490mm模数组合系统，灵活适配各类场景','images/1780243581594-981682795.jpg'],
    ['一套系统，经得起超多场景','从咖啡外摆、校园看台到商业快闪，标准模块自然适配不同空间','images/1780243588448-92696485.jpg'],
    ['像积木一样，自由生长','标准接口支持自由增减与重组，让空间随需求持续变化','images/1780243595396-85143086.jpg'],
    ['快速落地，减少现场干扰','预制模块到场即可组装，大幅缩短传统施工周期','images/1780243602136-873110398.jpg'],
    ['从产品到场景，一体完成','模块、配件与场景方案协同，让设计和交付保持一致','images/1780243607152-562793655.jpg'],
    ['可迁移、可复用、可持续','空间更新时模块可以拆装迁移，延长产品全生命周期','images/1780243612732-981338585.jpg'],
    ['耐久免维护，绿色可持续','面向高频户外使用，以耐候结构降低长期维护成本','images/1780243619027-692052585.jpg']
  ];
  var scenes=[
    ['城市公共景观','images/1780295467165-322298093.jpg','images/1780139052593-236600565.jpg'],
    ['文旅与露营度假','images/1780139052593-236600565.jpg','images/1779938605160-953802716.jpg'],
    ['教育与校园空间','images/1780139059585-792067431.jpg','images/1779938618804-619038077.jpg'],
    ['商业地产与示范区','images/1780295437020-717958591.jpg','images/1779938654011-479627822.jpg'],
    ['社区与庭院家居','images/1780295444122-4886938.jpg','images/1779938671946-296134626.jpg'],
    ['乡村振兴与美丽乡村','images/1780139081111-84146912.jpg','images/1779938695621-278902869.jpg']
  ];
  var whatSlots=[
    ['images/1780462178139-236523800.jpg','images/1780243355692-369088890.jpg','images/1780243364585-505190217.jpg'],
    ['images/1780243412741-325092500.jpg','images/1780243419779-195492134.jpg','images/1780243423094-73368246.jpg','images/1780243431393-991858585.jpg','images/1780243438188-858526493.jpg','images/1780243441865-645594658.jpg','images/1780243449563-801258767.jpg','images/1780243453569-320376304.jpg','images/1780243456040-855370316.jpg'],
    ['images/1780462197260-274622009.jpg','images/1780243487588-396416578.jpg','images/1780462204364-122845220.jpg','images/1780462206888-648922324.jpg','images/1780243497903-242704090.jpg'],
    ['images/1780462223868-34359299.jpg','images/1780243520383-121803990.jpg','images/1780462235260-450668796.jpg','images/1780462240397-103612468.jpg','images/1780462248341-538886294.jpg','images/1780243540431-118346097.jpg','images/1780462254245-40499997.jpg','images/1780243555289-281501703.jpg','images/1780243560242-586676594.jpg']
  ];
  function init(){
    function hydrateImages(section){
      if(!section)return;
      section.querySelectorAll('img[data-src]').forEach(function(image){
        image.src=image.dataset.src;
        image.removeAttribute('data-src');
      });
    }
    function hydrateNearViewport(section){
      if(!section)return;
      if(!('IntersectionObserver' in window)){hydrateImages(section);return;}
      var observer=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(!entry.isIntersecting)return;
          hydrateImages(entry.target);
          observer.unobserve(entry.target);
        });
      },{rootMargin:'600px 0px',threshold:0});
      observer.observe(section);
    }

    var heroImages=document.querySelectorAll('#heroBgImage img'),heroIndex=0;
    if(heroImages.length>1)setInterval(function(){heroImages[heroIndex].classList.remove('active');heroIndex=(heroIndex+1)%heroImages.length;heroImages[heroIndex].classList.add('active');},5200);

    var what=document.getElementById('section-what');
    var whatContainers=[document.querySelector('.what-img-left-1'),document.querySelector('.what-img-right-1'),document.querySelector('.what-img-left-2'),document.querySelector('.what-img-right-2')];
    var whatIndexes=[1,1,1,1];
    var whatStarted=false;
    function startWhat(){
      if(whatStarted)return;
      whatStarted=true;
      hydrateImages(what);
      what.querySelectorAll('.what-img-left,.what-img-right').forEach(function(el){el.classList.add('animate-in');});
      setInterval(function(){whatContainers.forEach(function(container,index){if(!container||whatSlots[index].length<2)return;setTimeout(function(){whatIndexes[index]=(whatIndexes[index]+1)%whatSlots[index].length;container.classList.add('is-changing');setTimeout(function(){var image=container.querySelector('img');image.onload=function(){container.classList.remove('is-changing');};image.src=whatSlots[index][whatIndexes[index]];if(image.complete)container.classList.remove('is-changing');},420);},index*180);});},3600);
    }
    if(what){
      if('IntersectionObserver' in window){
        var whatObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){startWhat();whatObserver.unobserve(entry.target);}});},{rootMargin:'600px 0px',threshold:0});
        whatObserver.observe(what);
      }else startWhat();
    }

    hydrateNearViewport(document.getElementById('section-why'));
    hydrateNearViewport(document.getElementById('section-scenes'));

    var whyIndex=0,whyMain=document.getElementById('whyMainImage'),whyTitle=document.getElementById('whyTitle'),whyDesc=document.getElementById('whyDesc'),whyLeft=document.querySelector('#whySideLeft img'),whyRight=document.querySelector('#whySideRight img'),whyDots=document.querySelectorAll('#whyDots .why-dot');
    function showWhy(index){whyIndex=(index+whyItems.length)%whyItems.length;var item=whyItems[whyIndex],prev=whyItems[(whyIndex-1+whyItems.length)%whyItems.length],next=whyItems[(whyIndex+1)%whyItems.length];whyMain.src=item[2];whyMain.alt=item[0];whyTitle.textContent=item[0];whyDesc.textContent=item[1];whyLeft.src=prev[2];whyRight.src=next[2];whyDots.forEach(function(dot,i){dot.classList.toggle('active',i===whyIndex);});}
    var whyPrev=document.getElementById('whyArrowPrev'),whyNext=document.getElementById('whyArrowNext');if(whyPrev)whyPrev.addEventListener('click',function(){showWhy(whyIndex-1);});if(whyNext)whyNext.addEventListener('click',function(){showWhy(whyIndex+1);});whyDots.forEach(function(dot){dot.addEventListener('click',function(){showWhy(Number(dot.dataset.index));});});

    var sceneIndex=0,sceneMain=document.getElementById('scenesMainImg'),sceneRight=document.getElementById('scenesRightImage'),sceneLabel=document.getElementById('scenesMainLabel'),sceneThumbs=document.querySelectorAll('#scenesThumbs .scenes-thumb');
    function showScene(index){sceneIndex=(index+scenes.length)%scenes.length;var scene=scenes[sceneIndex];sceneMain.src=scene[1];sceneMain.alt=scene[0];sceneRight.src=scene[2];sceneLabel.textContent=scene[0];sceneThumbs.forEach(function(thumb,i){thumb.classList.toggle('active',i===sceneIndex);});}
    var scenePrev=document.getElementById('scenesArrowPrev'),sceneNext=document.getElementById('scenesArrowNext');if(scenePrev)scenePrev.addEventListener('click',function(){showScene(sceneIndex-1);});if(sceneNext)sceneNext.addEventListener('click',function(){showScene(sceneIndex+1);});sceneThumbs.forEach(function(thumb){thumb.addEventListener('click',function(){showScene(Number(thumb.dataset.index));});});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

// 编辑器场景元素加载补丁：让推荐组合内置的人物、家具、阳伞按预设顺序落位。
(function(){
  var installTries=0;
  var activeElementType='';
  var loadWait={
    umbrella:3600,
    four_table_chair:3200,
    single_chair:5200,
    small_round_table:6200,
    school_blackboard:9000,
    business_person_01:2600,
    business_person_02:2600,
    business_person_03:2600,
    student_01:2600,
    student_02:2600,
    student_03:2600
  };
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  function canInstall(){
    return typeof window.toggleSceneElementMode==='function'&&typeof window.placeSceneElementAt==='function';
  }
  async function loadSceneElementsData(elementsData){
    if(!Array.isArray(elementsData)||elementsData.length===0)return;
    for(var i=0;i<elementsData.length;i++){
      var item=elementsData[i];
      if(!item||!item.elementType)continue;
      if(activeElementType!==item.elementType){
        window.toggleSceneElementMode(item.elementType);
        activeElementType=item.elementType;
        await wait(loadWait[item.elementType]||3600);
      }else{
        await wait(200);
      }
      window.placeSceneElementAt(item.x,item.z,item.rotationY||0,item.surfaceHeight||0);
    }
  }
  function install(){
    if(!canInstall()){
      installTries++;
      if(installTries<80)setTimeout(install,250);
      return;
    }
    window.loadSceneElementsData=loadSceneElementsData;
  }
  install();
})();
