// Load a renderer before starting the shared Copilot data and overlay layer.
const params = new URLSearchParams(location.search);
const notice = document.getElementById('sceneNotice');
const switchView = document.getElementById('viewToggle');
let canvas = document.getElementById('scene');
let view = '2d';
// The 2D mobile stage has a minimum width. Select the layout before the 3D
// renderer measures its canvas, so its projection matches the visible stage.
document.body.dataset.view = params.get('view') === '2d' ? '2d' : '3d';

if (params.get('view') !== '2d') {
  try {
    const { createOffice } = await import('./office-3d.js');
    window.Office = createOffice(canvas);
    view = '3d';
  } catch (error) {
    console.warn('3D village unavailable; loading the 2D village.', error);
    // A canvas with a WebGL context cannot later create a 2D context.
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    canvas = replacement;
    notice.textContent = '3D를 사용할 수 없어 2D 마을을 열었어요.';
    notice.hidden = false;
  }
}

document.body.dataset.view = view;
canvas.setAttribute('aria-label', view === '3d'
  ? '둥근 동물 친구들이 코파일럿 작업 상태에 따라 일하고 쉬는 3D 미니어처 마을'
  : '둥근 동물 친구들이 코파일럿 작업 상태에 따라 일하고 쉬는 2D 일러스트 마을');
if (view === '2d') await import('./office.js');

const destination = new URLSearchParams(location.search);
destination.set('view', view === '3d' ? '2d' : '3d');
switchView.href = `?${destination}`;
switchView.textContent = view === '3d' ? '2D 보기' : '3D 보기';
switchView.setAttribute('aria-label', view === '3d' ? '2D 일러스트 마을로 전환' : '3D 미니어처 마을로 전환');
document.getElementById('viewBadge').textContent = view === '3d' ? '3D MINIATURE' : '2D ILLUSTRATION';
document.getElementById('cameraControls').hidden = view !== '3d';
document.getElementById('sceneHelp').textContent = view === '3d'
  ? '드래그로 회전 · 스크롤로 확대 · 터치로도 둘러보세요'
  : '작은 화면에서는 옆으로 움직여 마을을 둘러보세요';

if (view === '3d') {
  document.getElementById('rotateLeft').addEventListener('click', () => Office.rotateBy(-Math.PI / 12));
  document.getElementById('rotateRight').addEventListener('click', () => Office.rotateBy(Math.PI / 12));
  document.getElementById('zoomIn').addEventListener('click', () => Office.zoomBy(1.15));
  document.getElementById('zoomOut').addEventListener('click', () => Office.zoomBy(1 / 1.15));
  document.getElementById('resetView').addEventListener('click', () => Office.resetView());
  canvas.addEventListener('webglcontextlost', () => {
    notice.textContent = '3D 화면을 다시 연결하고 있어요. 계속 멈춰 있으면 2D 보기를 선택해 주세요.';
    notice.hidden = false;
  });
  canvas.addEventListener('webglcontextrestored', () => { notice.hidden = true; });
}

await import('./app.js');
document.getElementById('sceneLoading').remove();
