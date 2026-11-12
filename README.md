# GPT6-Astra能力测试

## Jelly Ocean · 交互式果冻海洋

手机和电脑均可直接打开 `index.html`，所有资源内置。无需安装或联网。支持 WebGL 2 的现代浏览器。

- **手机：** 底部大按钮、参数抽屉、更多菜单、横竖屏与安全区适配；单指触摸或拖拽，双指缩放平移。双指手势不会在按下第一指时误触水波。
- **电脑：** 可收起侧栏、鼠标旋转/缩放/平移、键盘快捷键与全屏。
- **共同：** 沉浸模式、恢复控制按钮、自动/节能/高清三档画质、参数记忆。自动画质采用迟滞调节并支持恢复清晰度。



A self-contained Three.js / WebGL 2 miniature ocean. `dist/index.html` contains
the entire application, engine, shaders and procedural assets. Open it directly
in a modern browser; no CDN, server, installation or network is needed.

## Interaction

- Touch mode: click the actual water mesh to inject an impulse; hold and drag to
  apply a moving spring constraint. Release to see the surface rebound.
- Rotate on empty space or in observation mode. Wheel to zoom; right drag or
  Shift + drag to pan. On touchscreens, use two fingers to zoom and pan.
- Five live sliders control impulse/wind amplitude, elastic response, optical
  attenuation, stochastic wind forcing and lighting time.
- Presets, pause, view reset, three camera views, PNG export and desktop
  fullscreen are connected to the live scene. Space pauses; arrows rotate;
  +/- zoom; R resets the camera when the canvas has focus.

## Implementation

The water uses a fixed 120 Hz height/velocity lattice (89² desktop; 73² mobile),
with a tension Laplacian, bending term, damping, an elastic restoring term,
no-flux island boundaries, reflective outer boundaries and volume-mean removal.
Wind injects seeded stochastic pressure impulses. Dragging applies distributed
spring forces and drives two damped volume shear modes. No sine animation
displaces the water. This is an interactive elastic heightfield approximation,
not a full three-dimensional Navier–Stokes solver.

The sailboat integrates buoyancy and angular restoring forces from four real
heightfield samples. Fish use separation, alignment, reef avoidance and an
orbital swimming preference. Vegetation samples the wave field.

The custom water shaders use depth-aware screen-space refraction, a planar
reflection pass, Schlick Fresnel, sunlight specular highlights and exponential
volume absorption. A CPU Snell-law light-ray projection generates a caustic
irradiance texture from the changing surface normals. These are rasterized
real-time approximations, not path-traced volumetrics. The terrain and miniature
models are generated from geometry and batched by material.

Mobile layout folds sliders into a bottom sheet and secondary tools into a menu.
Pixel ratio adapts down under load and recovers after sustained headroom; reflections and caustics refresh every third frame. Rendering pauses when
the document is hidden. A clear error is shown when WebGL 2 is unavailable.

## Development

```
npm ci
npm run build
npm test
node tests/scene.test.mjs /tmp/jelly-shaders.json
```

`src/physics.js` is independent of the browser. `world.js` builds the models and
ecology; `water.js` builds the volume, shaders and render passes; `main.js` owns
the live controls, gestures, camera and animation; `shell.html` contains the UI.

## Validation

- Passed physical wave propagation, damping decay, volume conservation,
  continuous drag, release, maximum-parameter stability, reset and fixed-step
  determinism checks.
- Passed geometry/instance finiteness, outward wall normals, wave-driven boat
  response and day/night lighting checks.
- Compiled and linked 41 actual Three.js-preprocessed vertex/fragment shader
  pairs on the available Mesa OpenGL driver, with zero errors.
- The supplied preview browser reports `GL_RENDERER = Disabled` and cannot
  create any WebGL context. Visual browser QA, real-device frame rates and
  end-to-end pointer/touch acceptance remain unverified in that environment.

Three.js is pinned at r170 and its MIT license is embedded in the standalone
HTML. No generated image or prerecorded animation is used as the 3D scene.

## GitHub Pages

Pages 配置为 `Deploy from a branch` → `main` → `/(root)`。根目录 `index.html` 是可离线运行的完整成品。源码在 `src/`；构建后将 `dist/index.html` 复制到根目录以更新 Pages。

本次适配新增了触摸候选取消、手势移动阈值、取消事件，以及画质迟滞、恢复和边界测试。全部自动检查已通过；当前云浏览器禁用了 WebGL，因此真机触控、视觉和帧率尚待验证，不能据此保证所有手机稳定 60 FPS。
