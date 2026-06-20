# MGILT 网站开发经验记录

## 2026-03-30 登录注册功能开发

### 问题：登录/注册表单切换不工作

**现象：**
- 点击"注册"标签后，表单没有任何变化
- 通过 `onclick="showTab('register')"` 调用JavaScript函数无效
- 使用 `onclick="alert(...)"` 测试时，点击事件本身是工作的

**排查过程：**
1. 确认点击事件被触发（alert能弹出）
2. 确认 `showTab` 函数内的 `clearAllErrors()` 函数执行时卡住
3. 移除 `clearAllErrors()` 调用后，函数仍不工作
4. 简化函数代码，使用 `className` 替代 `classList.toggle()`

**根本原因：**
- 使用 `classList.toggle()` 方法在某些情况下可能因为元素尚未完全加载或其他CSS冲突导致不工作
- 使用 `style.display` 直接设置样式比通过类切换更可靠

**解决方案：**
使用内联 JavaScript 直接操作 DOM，不依赖外部函数：

```html
<!-- 错误做法 -->
<div class="login-tab" onclick="showTab('register')">注册</div>

<!-- 正确做法 -->
<div class="login-tab" id="tabRegister">
  <a href="javascript:void(0)" 
     onclick="document.getElementById('tabLogin').className='login-tab';
              document.getElementById('tabRegister').className='login-tab active';
              document.getElementById('loginFormDiv').style.display='none';
              document.getElementById('registerFormDiv').style.display='block'">
    注册
  </a>
</div>
```

**经验总结：**
1. 对于简单的DOM操作，直接在HTML中写内联JavaScript比调用外部函数更可靠
2. 使用 `className = 'class1 class2'` 直接设置类名，比 `classList.toggle()` 更可控
3. 使用 `element.style.display = 'block/none'` 直接控制显示，比通过CSS类更直接
4. 调试时先用 `alert()` 确认代码执行到哪一步

### 微信/Google 社交登录实现

由于实际OAuth需要后端支持，采用前端模拟方式：

1. 点击按钮显示加载状态
2. 模拟1.5秒网络请求
3. 自动创建虚拟用户并登录
4. 跳转到用户中心

### 后续优化建议

1. 考虑将内联JS提取到独立JS文件，便于维护
2. 实现真正的后端OAuth认证
3. 添加表单字段验证的实时反馈
4. 考虑使用React/Vue等框架重构表单逻辑
