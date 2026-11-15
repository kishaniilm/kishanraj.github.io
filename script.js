(function () {
  'use strict';

  const TOTAL_FRAMES = 192;
  const FRAME_PATH = (index) => `frames/frame_${String(index).padStart(4, '0')}.png?v=c1`;

  const canvas = document.getElementById('scroll-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderText = document.getElementById('loader-text');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const progressThumb = document.getElementById('scroll-progress-thumb');
  const progressLabel = document.getElementById('scroll-progress-label');
  const heroBgText = document.querySelector('.hero-bg-text');

  const images = new Array(TOTAL_FRAMES + 1);
  const loadedStatus = new Array(TOTAL_FRAMES + 1).fill(false);
  let loadedCount = 0;

  // Animation & Physics State
  let currentFrame = 1;
  let targetFrame = 1;
  let lastDrawnIndex = -1;

  // Cinematic Scale (Dolly-in Zoom)
  let currentScale = 1.0;
  let targetScale = 1.0;

  // Interactive Micro Mouse Parallax
  let mouseX = 0;
  let mouseY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;

  // High-DPI canvas resizing
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
    }

    if (lastDrawnIndex > 0) {
      drawFrame(lastDrawnIndex);
    }
  }

  // Draw frame with pitch black fill, aspect-ratio cover, zoom scale & parallax offset
  function drawFrame(frameIndex) {
    let img = images[frameIndex];

    if (!loadedStatus[frameIndex] || !img || !img.complete || img.naturalWidth === 0) {
      img = findNearestLoadedImage(frameIndex);
      if (!img || !img.complete || img.naturalWidth === 0) {
        // Fallback: clear canvas to deep obsidian black if no frames loaded
        const cw = canvas.width;
        const ch = canvas.height;
        ctx.fillStyle = '#050608';
        ctx.fillRect(0, 0, cw, ch);
        return;
      }
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    // Pitch black base clear
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, cw, ch);

    // Cover scale calculation
    const baseScale = Math.max(cw / iw, ch / ih);
    const effectiveScale = baseScale * currentScale;

    const renderWidth = iw * effectiveScale;
    const renderHeight = ih * effectiveScale;

    // Center alignment + subtle parallax tilt
    const offsetX = (cw - renderWidth) / 2 + currentTiltX * (cw * 0.015);
    const offsetY = (ch - renderHeight) / 2 + currentTiltY * (ch * 0.015);

    try {
      ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
      lastDrawnIndex = frameIndex;
    } catch (e) {
      // Ignore draw errors if image is in broken state
    }
  }

  function findNearestLoadedImage(targetIdx) {
    if (loadedStatus[targetIdx] && images[targetIdx] && images[targetIdx].naturalWidth > 0) {
      return images[targetIdx];
    }
    let step = 1;
    while (targetIdx - step >= 1 || targetIdx + step <= TOTAL_FRAMES) {
      if (targetIdx - step >= 1 && loadedStatus[targetIdx - step] && images[targetIdx - step] && images[targetIdx - step].naturalWidth > 0) {
        return images[targetIdx - step];
      }
      if (targetIdx + step <= TOTAL_FRAMES && loadedStatus[targetIdx + step] && images[targetIdx + step] && images[targetIdx + step].naturalWidth > 0) {
        return images[targetIdx + step];
      }
      step++;
    }
    return (images[1] && images[1].naturalWidth > 0) ? images[1] : null;
  }

  // Calculate target frame and cinematic zoom from full page scroll position
  function updateScrollProgress() {
    const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) {
      targetFrame = 1;
      targetScale = 1.0;
      return;
    }

    const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
    targetFrame = 1 + progress * (TOTAL_FRAMES - 1);

    // Subtle cinematic dolly zoom (1.0 to 1.06)
    targetScale = 1.0 + progress * 0.06;

    // Parallax on hero giant text
    if (heroBgText && scrollTop < window.innerHeight * 1.5) {
      const heroParallax = scrollTop * 0.25;
      heroBgText.style.transform = `translateY(${heroParallax}px)`;
      heroBgText.style.opacity = Math.max(0, 0.9 - (scrollTop / (window.innerHeight * 0.8)));
    }

    // Update side progress tracker
    if (progressThumb) {
      progressThumb.style.height = (progress * 100) + '%';
    }
    if (progressLabel) {
      const displayIdx = String(Math.round(targetFrame)).padStart(3, '0');
      progressLabel.textContent = `${displayIdx} / ${TOTAL_FRAMES}`;
    }

    // Fade scroll hint indicator
    if (scrollTop > 60 && scrollIndicator) {
      scrollIndicator.classList.add('faded');
    } else if (scrollTop <= 60 && scrollIndicator) {
      scrollIndicator.classList.remove('faded');
    }
  }

  // Animation render loop (smooth lerp interpolation)
  function renderLoop() {
    // Smooth frame lerp
    const frameDiff = targetFrame - currentFrame;
    if (Math.abs(frameDiff) > 0.001) {
      currentFrame += frameDiff * 0.1;
    } else {
      currentFrame = targetFrame;
    }

    // Smooth scale lerp
    const scaleDiff = targetScale - currentScale;
    if (Math.abs(scaleDiff) > 0.0001) {
      currentScale += scaleDiff * 0.08;
    } else {
      currentScale = targetScale;
    }

    // Smooth mouse parallax lerp
    currentTiltX += (mouseX - currentTiltX) * 0.05;
    currentTiltY += (mouseY - currentTiltY) * 0.05;

    const frameToDraw = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(currentFrame)));
    drawFrame(frameToDraw);

    requestAnimationFrame(renderLoop);
  }

  // Mouse move listener for micro-parallax
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Frame loading manager
  function preloadFrames() {
    // Safety fallback: dismiss loader after 2 seconds regardless of image loading status
    setTimeout(() => {
      dismissLoader();
    }, 2000);

    const firstImg = new Image();
    firstImg.src = FRAME_PATH(1);
    images[1] = firstImg;

    firstImg.onload = () => {
      loadedStatus[1] = true;
      loadedCount++;
      resizeCanvas();
      drawFrame(1);
      loadRemainingFrames();
    };

    firstImg.onerror = () => {
      loadedCount++;
      loadRemainingFrames();
      onFrameLoaded();
    };
  }

  function loadRemainingFrames() {
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i);
      images[i] = img;

      img.onload = () => {
        loadedStatus[i] = true;
        loadedCount++;
        onFrameLoaded();
      };

      img.onerror = () => {
        loadedCount++;
        onFrameLoaded();
      };
    }
  }

  function dismissLoader() {
    if (loader && !loader.classList.contains('hidden')) {
      if (loaderBar) loaderBar.style.width = '100%';
      if (loaderText) loaderText.textContent = '100%';
      setTimeout(() => {
        loader.classList.add('hidden');
      }, 200);
    }
  }

  function onFrameLoaded() {
    const percent = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
    if (loaderBar) loaderBar.style.width = percent + '%';
    if (loaderText) loaderText.textContent = `${percent}%`;

    if (loadedCount >= TOTAL_FRAMES) {
      dismissLoader();
    }
  }

  // Certificate Lightbox Modal Handling
  window.openCertModal = function (imgSrc, title) {
    const modal = document.getElementById('cert-modal');
    const img = document.getElementById('cert-modal-img');
    const titleEl = document.getElementById('cert-modal-title');
    if (!modal || !img || !titleEl) return;
    img.src = imgSrc;
    titleEl.textContent = title;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeCertModal = function () {
    const modal = document.getElementById('cert-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeCertModal();
    }
  });

  // Resume Tab Switching
  window.switchResumeTab = function (mode) {
    const docView = document.getElementById('resume-doc-view');
    const pdfView = document.getElementById('resume-pdf-view');
    const tabDoc = document.getElementById('tab-doc');
    const tabPdf = document.getElementById('tab-pdf');

    if (!docView || !pdfView || !tabDoc || !tabPdf) return;

    if (mode === 'doc') {
      docView.style.display = 'block';
      pdfView.style.display = 'none';
      tabDoc.classList.add('active');
      tabPdf.classList.remove('active');
    } else {
      docView.style.display = 'none';
      pdfView.style.display = 'block';
      tabPdf.classList.add('active');
      tabDoc.classList.remove('active');
    }
  };

  // Interactive Contact Form Handling ("Then main send pe click karunga and ye ab hamari website")
  function initContactForm() {
    const form = document.getElementById('contact-form');
    const sendBtn = document.getElementById('send-btn');
    const feedback = document.getElementById('form-feedback');

    if (!form || !sendBtn) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('sender-name').value.trim();
      const email = document.getElementById('sender-email').value.trim();
      const message = document.getElementById('sender-message').value.trim();

      if (!name || !email || !message) {
        feedback.className = 'form-feedback error';
        feedback.textContent = 'Please fill out all fields.';
        return;
      }

      // Button loading state
      const originalHtml = sendBtn.innerHTML;
      sendBtn.innerHTML = '<span class="btn-text">Sending...</span>';
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.7';

      setTimeout(() => {
        // Success animation & notification
        sendBtn.innerHTML = '<span class="btn-text">Sent! ✓</span>';
        sendBtn.style.background = '#16a34a';
        sendBtn.style.opacity = '1';

        feedback.className = 'form-feedback success';
        feedback.textContent = `Thank you, ${name}! Your message has been received. Let's create something great together!`;

        form.reset();

        setTimeout(() => {
          sendBtn.innerHTML = originalHtml;
          sendBtn.style.background = '';
          sendBtn.disabled = false;
        }, 4000);
      }, 700);
    });
  }

  // Setup Event Listeners
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // Initialize Everything
  resizeCanvas();
  preloadFrames();
  initContactForm();
  requestAnimationFrame(renderLoop);
})();
