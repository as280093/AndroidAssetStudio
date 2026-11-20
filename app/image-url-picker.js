// Comprehensive Multi-Tier Icon Extractor & Gallery for Android Asset Studio
// Tiers 1-5 + Modern & Legacy Standards + Soft-404 / Multi-Resolution ICO / CORS Handling
(function() {
  'use strict';

  var GOOGLE_FALLBACK_GLOBE_BYTES = 726;

  function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 3500;
    var controller = new AbortController();
    var id = setTimeout(function() { controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options, { signal: controller.signal });
    return fetch(url, opts)
      .then(function(res) {
        clearTimeout(id);
        return res;
      })
      .catch(function(err) {
        clearTimeout(id);
        throw err;
      });
  }

  
  function normalizeColorToHex(str) {
    if (!str) return null;
    str = String(str).trim();
    if (/^#([0-9a-f]{3})$/i.test(str)) {
      return ('#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3]).toLowerCase();
    }
    if (/^#([0-9a-f]{6})$/i.test(str)) {
      return str.toLowerCase();
    }
    if (/^#([0-9a-f]{8})$/i.test(str)) {
      return str.substring(0, 7).toLowerCase();
    }
    if (/^rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(str)) {
      var nums = str.match(/\d+/g);
      if (nums && nums.length >= 3) {
        var r = Math.min(255, parseInt(nums[0], 10)).toString(16).padStart(2, '0');
        var g = Math.min(255, parseInt(nums[1], 10)).toString(16).padStart(2, '0');
        var b = Math.min(255, parseInt(nums[2], 10)).toString(16).padStart(2, '0');
        return ('#' + r + g + b).toLowerCase();
      }
    }
    return null;
  }

  var IconExtractor = {
    getApexDomain: function(hostname) {
      if (!hostname) return '';
      var parts = hostname.toLowerCase().split('.');
      if (parts.length <= 2) return hostname;
      var secondLast = parts[parts.length - 2];
      if (['co', 'com', 'org', 'net', 'edu', 'gov'].indexOf(secondLast) >= 0 && parts.length > 2) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    },

    resolveUrl: function(relativeUrl, baseUrl) {
      if (!relativeUrl) return null;
      var trimmed = String(relativeUrl).trim();
      if (!trimmed) return null;
      if (trimmed.indexOf('data:') === 0) return trimmed;
      if (trimmed.indexOf('//') === 0) {
        var proto = baseUrl && baseUrl.indexOf('http:') === 0 ? 'http:' : 'https:';
        return proto + trimmed;
      }
      try {
        return new URL(trimmed, baseUrl).href;
      } catch (e) {
        return null;
      }
    },

    parseHtmlHead: function(htmlText, baseUrl) {
      var icons = [];
      var colors = [];
      if (!htmlText || typeof htmlText !== 'string' || htmlText.length < 40) return { icons: icons, colors: colors };

      var docBase = baseUrl;
      var baseMatch = htmlText.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
      if (baseMatch && baseMatch[1]) {
        docBase = IconExtractor.resolveUrl(baseMatch[1], baseUrl) || baseUrl;
      }

      // Tier 1: Standard & Legacy <link> tags
      var linkRegex = /<link\s+([^>]+)>/gi;
      var match;
      while ((match = linkRegex.exec(htmlText)) !== null) {
        var attrsStr = match[1];
        var relMatch = attrsStr.match(/rel=["']([^"']+)["']/i);
        var hrefMatch = attrsStr.match(/href=["']([^"']+)["']/i);
        if (!relMatch || !hrefMatch) continue;

        var relTokens = relMatch[1].toLowerCase().split(/\s+/);
        var rawHref = hrefMatch[1];
        var resolved = IconExtractor.resolveUrl(rawHref, docBase);
        if (!resolved) continue;

        var sizesMatch = attrsStr.match(/sizes=["']([^"']+)["']/i);
        var sizesStr = sizesMatch ? sizesMatch[1] : '';

        if (relTokens.indexOf('mask-icon') >= 0) {
          icons.push({ name: 'Safari Pinned Tab (SVG)', url: resolved, type: 'mask-icon', sizes: sizesStr });
        } else if (relTokens.indexOf('fluid-icon') >= 0) {
          icons.push({ name: 'Fluid High-Res Icon', url: resolved, type: 'fluid-icon', sizes: sizesStr });
        } else if (relTokens.indexOf('apple-touch-icon-precomposed') >= 0) {
          icons.push({ name: 'Apple Touch Precomposed', url: resolved, type: 'apple-touch-icon', sizes: sizesStr });
        } else if (relTokens.indexOf('apple-touch-icon') >= 0) {
          icons.push({ name: 'Apple Touch Icon ' + (sizesStr || ''), url: resolved, type: 'apple-touch-icon', sizes: sizesStr });
        } else if (relTokens.indexOf('image_src') >= 0) {
          icons.push({ name: 'Image Source Preview', url: resolved, type: 'image_src', sizes: sizesStr });
        } else if (relTokens.indexOf('icon') >= 0 || (relTokens.indexOf('shortcut') >= 0 && relTokens.indexOf('icon') >= 0)) {
          icons.push({ name: 'Page Favicon ' + (sizesStr || ''), url: resolved, type: 'icon', sizes: sizesStr });
        } else if (relTokens.indexOf('manifest') >= 0) {
          icons.push({ name: 'Web App Manifest', url: resolved, type: 'manifest' });
        } else if (relTokens.indexOf('yandex-tableau-widget') >= 0) {
          icons.push({ name: 'Yandex Tableau Manifest', url: resolved, type: 'yandex-manifest' });
        }
      }

      // Tier 1: Microsoft & Social Graph <meta> tags
      var metaRegex = /<meta\s+([^>]+)>/gi;
      while ((match = metaRegex.exec(htmlText)) !== null) {
        var mAttrsStr = match[1];
        var nameMatch = mAttrsStr.match(/(?:name|property)=["']([^"']+)["']/i);
        var contentMatch = mAttrsStr.match(/content=["']([^"']+)["']/i);
        if (!nameMatch || !contentMatch) continue;

        var propName = nameMatch[1].toLowerCase();
        var content = contentMatch[1].trim();
        if (!content || content.toLowerCase() === 'none') continue;
        var mResolved = IconExtractor.resolveUrl(content, docBase);
        if (!mResolved) continue;

        if (propName === 'msapplication-tileimage') {
          icons.push({ name: 'Windows Tile Image', url: mResolved, type: 'ms-tile' });
        } else if (propName === 'msapplication-square70x70logo') {
          icons.push({ name: 'Windows Small Tile (70x70)', url: mResolved, type: 'ms-tile-70' });
        } else if (propName === 'msapplication-square150x150logo') {
          icons.push({ name: 'Windows Medium Tile (150x150)', url: mResolved, type: 'ms-tile-150' });
        } else if (propName === 'msapplication-wide310x150logo') {
          icons.push({ name: 'Windows Wide Tile (310x150)', url: mResolved, type: 'ms-tile-310x150' });
        } else if (propName === 'msapplication-square310x310logo') {
          icons.push({ name: 'Windows Large Tile (310x310)', url: mResolved, type: 'ms-tile-310' });
        } else if (propName === 'msapplication-config') {
          icons.push({ name: 'BrowserConfig XML', url: mResolved, type: 'browserconfig' });
        } else if (propName === 'og:image') {
          icons.push({ name: 'Open Graph Social Image', url: mResolved, type: 'og:image' });
        } else if (propName === 'twitter:image' || propName === 'twitter:image:src') {
          icons.push({ name: 'Twitter Card Image', url: mResolved, type: 'twitter:image' });
        }
      }

      // Extract brand colors from meta tags
      var colorMetaRegex = /<meta\s+([^>]+)>/gi;
      var cm;
      while ((cm = colorMetaRegex.exec(htmlText)) !== null) {
        var cAttrs = cm[1];
        var nMatch = cAttrs.match(/(?:name|property)=["']([^"']+)["']/i);
        var valMatch = cAttrs.match(/content=["']([^"']+)["']/i);
        if (nMatch && valMatch) {
          var pN = nMatch[1].toLowerCase();
          var pVal = normalizeColorToHex(valMatch[1]);
          if (pVal) {
            if (pN === 'theme-color') {
              colors.push({ hex: pVal, label: 'Theme Color', source: 'meta[theme-color]' });
            } else if (pN === 'msapplication-tilecolor') {
              colors.push({ hex: pVal, label: 'Tile Color', source: 'meta[msapplication-TileColor]' });
            } else if (pN === 'msapplication-navbutton-color') {
              colors.push({ hex: pVal, label: 'Nav Color', source: 'meta[msapplication-navbutton-color]' });
            }
          }
        }
      }

      // Extract mask-icon color
      var maskMatch = htmlText.match(/<link\s+[^>]*rel=["'][^"']*mask-icon[^"']*["'][^>]*color=["']([^"']+)["']/i);
      if (maskMatch && maskMatch[1]) {
        var mColor = normalizeColorToHex(maskMatch[1]);
        if (mColor) colors.push({ hex: mColor, label: 'Brand Color', source: 'link[mask-icon]' });
      }

      // Scan HTML for auto-generated or hashed manifest filenames (e.g. manifest-web-player.*.json)
      var manifestRegex = /["']([^"'\s<>]*(?:manifest|\.webmanifest)[^"'\s<>]*)["']/gi;
      var mMatch;
      var seenManifestUrls = {};
      while ((mMatch = manifestRegex.exec(htmlText)) !== null) {
        var rawM = mMatch[1];
        if (!rawM) continue;
        if (/\.(json|webmanifest)(\?.*)?$/i.test(rawM) || /manifest/i.test(rawM)) {
          var resolvedM = IconExtractor.resolveUrl(rawM, docBase);
          if (resolvedM && !seenManifestUrls[resolvedM]) {
            seenManifestUrls[resolvedM] = true;
            icons.push({ name: 'Web App Manifest', url: resolvedM, type: 'manifest' });
          }
        }
      }

      return { icons: icons, colors: colors };
    },

    parseManifestJson: function(manifestText, manifestUrl) {
      var icons = [];
      var colors = [];
      try {
        var data = JSON.parse(manifestText);
        if (data.theme_color) {
          var tc = normalizeColorToHex(data.theme_color);
          if (tc) colors.push({ hex: tc, label: 'Theme Color', source: 'manifest.json' });
        }
        if (data.background_color) {
          var bc = normalizeColorToHex(data.background_color);
          if (bc) colors.push({ hex: bc, label: 'Background Color', source: 'manifest.json' });
        }
        if (Array.isArray(data.icons)) {
          var sorted = data.icons.slice().sort(function(a, b) {
            var aAny = (a.purpose || 'any').indexOf('any') >= 0;
            var bAny = (b.purpose || 'any').indexOf('any') >= 0;
            if (aAny && !bAny) return -1;
            if (!aAny && bAny) return 1;
            return 0;
          });
          sorted.forEach(function(icon) {
            if (!icon.src) return;
            var resolved = IconExtractor.resolveUrl(icon.src, manifestUrl);
            if (resolved) {
              var label = 'Manifest Icon ' + (icon.sizes || '');
              icons.push({ name: label.trim(), url: resolved, type: 'manifest-icon', sizes: icon.sizes });
            }
          });
        }
      } catch (e) {}
      return { icons: icons, colors: colors };
    },

    parseBrowserConfigXml: function(xmlText, configUrl) {
      var icons = [];
      var colors = [];
      try {
        var tileColorMatch = xmlText.match(/<TileColor>([^<]+)<\/TileColor>/i);
        if (tileColorMatch && tileColorMatch[1]) {
          var tHex = normalizeColorToHex(tileColorMatch[1]);
          if (tHex) colors.push({ hex: tHex, label: 'Tile Color', source: 'browserconfig.xml' });
        }

        var regex = /<(TileImage|square70x70logo|square150x150logo|wide310x150logo|square310x310logo)[^>]*src=["']([^"']+)["']/gi;
        var match;
        while ((match = regex.exec(xmlText)) !== null) {
          var tag = match[1];
          var src = match[2];
          var resolved = IconExtractor.resolveUrl(src, configUrl);
          if (resolved) {
            icons.push({ name: 'MS Tile (' + tag + ')', url: resolved, type: 'browserconfig-icon' });
          }
        }
      } catch (e) {}
      return { icons: icons, colors: colors };
    },

    parseYandexManifestJson: function(jsonText, jsonUrl) {
      var icons = [];
      try {
        var data = JSON.parse(jsonText);
        if (data && data.layout && data.layout.logo) {
          var resolved = IconExtractor.resolveUrl(data.layout.logo, jsonUrl);
          if (resolved) {
            icons.push({ name: 'Yandex Tableau Logo', url: resolved, type: 'yandex-logo' });
          }
        }
      } catch (e) {}
      return icons;
    },

    getComprehensiveRootPaths: function(origin) {
      return [
        // Modern & High-Res Formats
        { name: 'Favicon SVG', url: origin + '/favicon.svg' },
        { name: 'App Router Icon SVG', url: origin + '/icon.svg' },
        { name: 'App Router Icon PNG', url: origin + '/icon.png' },
        { name: 'Apple Icon', url: origin + '/apple-icon.png' },
        { name: 'Android Chrome 512', url: origin + '/android-chrome-512x512.png' },
        { name: 'Android Chrome 192', url: origin + '/android-chrome-192x192.png' },
        { name: 'Apple Touch Icon', url: origin + '/apple-touch-icon.png' },
        { name: 'Apple Touch 180', url: origin + '/apple-touch-icon-180x180.png' },
        { name: 'Apple Touch 152', url: origin + '/apple-touch-icon-152x152.png' },
        { name: 'Apple Touch 120', url: origin + '/apple-touch-icon-120x120.png' },
        { name: 'Apple Touch Precomposed', url: origin + '/apple-touch-icon-precomposed.png' },

        // Standard & Mid-Era Desktop Paths
        { name: 'Favicon 96', url: origin + '/favicon-96x96.png' },
        { name: 'Favicon 32', url: origin + '/favicon-32x32.png' },
        { name: 'Favicon 16', url: origin + '/favicon-16x16.png' },
        { name: 'Favicon PNG', url: origin + '/favicon.png' },
        { name: 'MS Tile 150', url: origin + '/mstile-150x150.png' },
        { name: 'MS Tile 310', url: origin + '/mstile-310x310.png' },

        // Legacy 1990s-2000s Formats
        { name: 'Favicon ICO', url: origin + '/favicon.ico' },
        { name: 'Favicon GIF', url: origin + '/favicon.gif' },
        { name: 'Favicon JPG', url: origin + '/favicon.jpg' },
        { name: 'Favicon JPEG', url: origin + '/favicon.jpeg' },
        { name: 'Site Logo PNG', url: origin + '/logo.png' },
        { name: 'Site Logo SVG', url: origin + '/logo.svg' }
      ];
    },

    parseIcoFrames: function(arrayBuffer) {
      if (!arrayBuffer || arrayBuffer.byteLength < 6) return null;
      var view = new DataView(arrayBuffer);
      var reserved = view.getUint16(0, true);
      var type = view.getUint16(2, true);
      var count = view.getUint16(4, true);
      if (reserved !== 0 || type !== 1 || count === 0) return null;

      var entries = [];
      for (var i = 0; i < count; i++) {
        var offset = 6 + i * 16;
        if (offset + 16 > arrayBuffer.byteLength) break;
        var w = view.getUint8(offset) || 256;
        var h = view.getUint8(offset + 1) || 256;
        var bpp = view.getUint16(offset + 6, true);
        var size = view.getUint32(offset + 8, true);
        var imgOffset = view.getUint32(offset + 12, true);

        var isPng = false;
        if (imgOffset + 8 <= arrayBuffer.byteLength) {
          var u8 = new Uint8Array(arrayBuffer, imgOffset, 8);
          if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
            isPng = true;
          }
        }
        entries.push({ w: w, h: h, bpp: bpp, size: size, imgOffset: imgOffset, isPng: isPng });
      }
      return entries;
    },

    isSoft404: function(blob, previewText) {
      if (!blob) return true;
      var type = (blob.type || '').toLowerCase();
      if (type.indexOf('text/html') >= 0 || type.indexOf('text/plain') >= 0) {
        return true;
      }
      if (previewText) {
        var lower = previewText.toLowerCase().trim();
        if (lower.indexOf('<!doctype') === 0 || lower.indexOf('<html') === 0 || lower.indexOf('<head') === 0) {
          return true;
        }
      }
      return false;
    },

    blobToDataUri: function(blob) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) { resolve(e.target.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },

    fetchAsDataUri: async function(url) {
      if (!url) return null;
      if (url.indexOf('data:') === 0) return url;

      // Direct CORS fetch attempt (fast 3s timeout)
      try {
        var res = await fetchWithTimeout(url, { mode: 'cors' }, 3000);
        if (res.ok) {
          var blob = await res.blob();
          if (blob.size > 0 && blob.size !== GOOGLE_FALLBACK_GLOBE_BYTES) {
            var headSlice = await blob.slice(0, 100).text();
            if (!IconExtractor.isSoft404(blob, headSlice)) {
              if (url.toLowerCase().indexOf('.ico') >= 0 || blob.type === 'image/x-icon') {
                var ab = await blob.arrayBuffer();
                var frames = IconExtractor.parseIcoFrames(ab);
                if (frames && frames.length > 0) {
                  var largest = frames.reduce(function(prev, curr) {
                    return (curr.w * curr.h > prev.w * prev.h) ? curr : prev;
                  }, frames[0]);
                  if (largest.isPng) {
                    var pngSlice = ab.slice(largest.imgOffset, largest.imgOffset + largest.size);
                    var pngBlob = new Blob([pngSlice], { type: 'image/png' });
                    return await IconExtractor.blobToDataUri(pngBlob);
                  }
                }
              }
              return await IconExtractor.blobToDataUri(blob);
            }
          }
        }
      } catch (e) {}

      // Proxy fallback with wsrv.nl (safe image proxying to avoid canvas tainting)
      try {
        var proxyUrl = 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&output=png';
        var res2 = await fetchWithTimeout(proxyUrl, {}, 3500);
        if (res2.ok) {
          var blob2 = await res2.blob();
          if (blob2.size > 0 && blob2.size !== GOOGLE_FALLBACK_GLOBE_BYTES) {
            var headSlice2 = await blob2.slice(0, 100).text();
            if (!IconExtractor.isSoft404(blob2, headSlice2)) {
              return await IconExtractor.blobToDataUri(blob2);
            }
          }
        }
      } catch (e) {}

      return null;
    },

    fetchTextViaProxies: function(url) {
      // Race direct fetch and CORS proxies with 3.8s timeout
      return new Promise(function(resolve) {
        var settled = false;
        function finish(val) {
          if (!settled && val && typeof val === 'string' && val.length > 20) {
            // Guard against error JSON or API key prompts from broken proxies
            if (val.indexOf('API key is required') >= 0 || val.indexOf('corsproxy.io') >= 0) return;
            if (val.indexOf('Cloudflare Ray ID') >= 0 || val.indexOf('Error 522') >= 0 || val.indexOf('Web server is returning an unknown error') >= 0) return;
            // If requesting a JSON/manifest file, reject HTML error responses
            if (/\.(json|webmanifest)(\?.*)?$/i.test(url) && (val.trim().indexOf('<!DOCTYPE') === 0 || val.trim().indexOf('<html') === 0)) return;
            settled = true;
            resolve(val);
          }
        }

        // Direct fetch attempt (if server sends CORS headers)
        fetchWithTimeout(url, { mode: 'cors' }, 2500)
          .then(function(r) { return r.ok ? r.text() : null; })
          .then(finish).catch(function() {});

        // AllOrigins Raw
        fetchWithTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), {}, 3500)
          .then(function(r) { return r.ok ? r.text() : null; })
          .then(finish).catch(function() {});

        // AllOrigins JSON wrapper
        fetchWithTimeout('https://api.allorigins.win/get?url=' + encodeURIComponent(url), {}, 3500)
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(data) { if (data && data.contents) finish(data.contents); }).catch(function() {});

        setTimeout(function() {
          if (!settled) {
            settled = true;
            resolve(null);
          }
        }, 3800);
      });
    }
  };

  // UI Integration with Android Asset Studio
  window.addEventListener('load', function() {
    function initStudioEnhancement() {
      var container = document.querySelector('.form-field-image > .form-field-container');
      if (!container) {
        setTimeout(initStudioEnhancement, 100);
        return;
      }

      var imageRadio = document.querySelector('input[value="image"]');
      var clipartRadio = document.querySelector('input[value="clipart"]');
      var textRadio = document.querySelector('input[value="text"]');
      if (!imageRadio) {
        setTimeout(initStudioEnhancement, 100);
        return;
      }

      var fileInput = document.querySelector('.form-image-hidden-file-field');
      var dropTarget = document.querySelector('.form-field-image');
      var imageLabel = document.querySelector('label[for="' + imageRadio.id + '"]');

      if (imageLabel) {
        // Intercept click in the capture phase so that legacy app.js handler never fires fileInput.click()
        imageLabel.addEventListener('click', function(e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          imageRadio.checked = true;
          clipartRadio.checked = false;
          textRadio.checked = false;
          updateActiveMode();
        }, true);
      }

      imageRadio.addEventListener('click', function(e) {
        e.stopImmediatePropagation();
        imageRadio.checked = true;
        updateActiveMode();
      }, true);

      if (document.querySelector('.form-image-type-params-image')) {
        return; // Already initialized
      }

      var imageParamsEl = document.createElement('div');
      imageParamsEl.className = 'form-image-type-params form-image-type-params-image is-hidden';

      // 1. URL Search Bar
      var urlBar = document.createElement('div');
      urlBar.className = 'form-image-url-bar';

      var urlInput = document.createElement('input');
      urlInput.className = 'form-image-url-input';
      urlInput.type = 'text';
      urlInput.placeholder = 'Enter website URL (e.g. google.com) or image link';
      urlInput.spellcheck = false;

      var searchBtn = document.createElement('button');
      searchBtn.className = 'form-image-url-search-btn';
      searchBtn.type = 'button';
      searchBtn.title = 'Fetch icons from URL';
      searchBtn.innerHTML = '<i class="material-icons">arrow_forward</i>';

      urlBar.appendChild(urlInput);
      urlBar.appendChild(searchBtn);
      imageParamsEl.appendChild(urlBar);

      // 2. Action Toolbar
      var actionToolbar = document.createElement('div');
      actionToolbar.className = 'form-image-action-toolbar';

      var uploadBtn = document.createElement('button');
      uploadBtn.className = 'form-image-upload-btn';
      uploadBtn.type = 'button';
      uploadBtn.innerHTML = '<i class="material-icons">file_upload</i> Upload image';
      uploadBtn.onclick = function() { fileInput.click(); };

      var dropHint = document.createElement('span');
      dropHint.className = 'form-image-drop-hint';
      dropHint.textContent = 'or drop file here';

      actionToolbar.appendChild(uploadBtn);
      actionToolbar.appendChild(dropHint);
      imageParamsEl.appendChild(actionToolbar);

      // 3. Results Container
      var resultsContainer = document.createElement('div');
      resultsContainer.className = 'form-image-results-container cancel-parent-scroll';

      var gridEl = document.createElement('div');
      gridEl.className = 'form-image-grid';
      gridEl.style.display = 'none';

      var stateEl = document.createElement('div');
      stateEl.className = 'form-image-state-message';

      resultsContainer.appendChild(gridEl);
      resultsContainer.appendChild(stateEl);
      imageParamsEl.appendChild(resultsContainer);

      // 4. Footer with Backdrop Switcher
      var footerEl = document.createElement('div');
      footerEl.className = 'form-image-footer';
      footerEl.innerHTML = '\
        <div class="form-image-bg-selector">\
          <span class="bg-selector-label">Bg:</span>\
          <div class="bg-swatches">\
            <button type="button" class="bg-swatch is-active" data-bg="checker" title="Checkerboard (Transparent)"></button>\
            <button type="button" class="bg-swatch" data-bg="#ffffff" title="Light / White" style="background-color: #ffffff;"></button>\
            <button type="button" class="bg-swatch" data-bg="#212121" title="Dark / Charcoal" style="background-color: #212121;"></button>\
            <button type="button" class="bg-swatch" data-bg="#1976d2" title="Vivid Blue" style="background-color: #1976d2;"></button>\
            <button type="button" class="bg-swatch" data-bg="#009688" title="Vivid Teal" style="background-color: #009688;"></button>\
            <button type="button" class="bg-swatch" data-bg="#ff9800" title="Vivid Amber" style="background-color: #ff9800;"></button>\
            <label class="bg-swatch bg-swatch-custom" title="Custom color">\
              <input type="color" value="#673ab7" class="bg-color-picker-input">\
            </label>\
          </div>\
        </div>\
        <div class="form-image-footer-meta">\
          <span>Sorted by highest quality</span>\
        </div>\
      ';
      imageParamsEl.appendChild(footerEl);

      function setPreviewBackdrop(bgValue, isCustom) {
        var swatches = footerEl.querySelectorAll('.bg-swatch');
        swatches.forEach(function(s) { s.classList.remove('is-active'); });
        var activeSwatch = isCustom
          ? footerEl.querySelector('.bg-swatch-custom')
          : footerEl.querySelector('.bg-swatch[data-bg="' + bgValue + '"]');
        if (activeSwatch) activeSwatch.classList.add('is-active');

        var dynStyle = document.getElementById('dynamic-thumb-style');
        if (!dynStyle) {
          dynStyle = document.createElement('style');
          dynStyle.id = 'dynamic-thumb-style';
          document.head.appendChild(dynStyle);
        }

        if (bgValue === 'checker') {
          resultsContainer.style.setProperty('--thumb-bg', '#fff');
          resultsContainer.style.setProperty('--thumb-pattern', 'linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)');
          dynStyle.textContent = '.form-image-card-thumb { background-color: #fff !important; background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%) !important; }';
        } else {
          resultsContainer.style.setProperty('--thumb-bg', bgValue);
          resultsContainer.style.setProperty('--thumb-pattern', 'none');
          dynStyle.textContent = '.form-image-card-thumb { background-color: ' + bgValue + ' !important; background-image: none !important; }';
        }

        try {
          localStorage.setItem('assetStudioThumbBg', bgValue);
        } catch(e) {}
      }

      footerEl.querySelectorAll('.bg-swatch:not(.bg-swatch-custom)').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          var bg = btn.getAttribute('data-bg');
          setPreviewBackdrop(bg, false);
        });
      });

      var customColorInput = footerEl.querySelector('.bg-color-picker-input');
      if (customColorInput) {
        customColorInput.addEventListener('input', function(e) {
          setPreviewBackdrop(e.target.value, true);
        });
        customColorInput.addEventListener('change', function(e) {
          setPreviewBackdrop(e.target.value, true);
        });
      }

      // Restore user background preference if available
      try {
        var savedBg = localStorage.getItem('assetStudioThumbBg');
        if (savedBg) {
          var isCustom = savedBg.indexOf('#') === 0 && !footerEl.querySelector('.bg-swatch[data-bg="' + savedBg + '"]');
          if (isCustom && customColorInput) {
            customColorInput.value = savedBg;
          }
          setPreviewBackdrop(savedBg, isCustom);
        }
      } catch(e) {}

      // Insert imageParamsEl right after buttonset
      var buttonset = container.querySelector('.form-field-buttonset');
      buttonset.parentNode.insertBefore(imageParamsEl, buttonset.nextSibling);

      function showInitialState() {
        gridEl.style.display = 'none';
        stateEl.style.display = 'flex';
        stateEl.innerHTML = '\
          <i class="material-icons">image_search</i>\
          <div class="state-title">Fetch icons from any website</div>\
          <div class="state-subtitle">Enter a website URL above or pick a sample:</div>\
          <div class="quick-sample-chips">\
            <span class="sample-chip" data-domain="google.com">google.com</span>\
            <span class="sample-chip" data-domain="github.com">github.com</span>\
            <span class="sample-chip" data-domain="apple.com">apple.com</span>\
            <span class="sample-chip" data-domain="spotify.com">spotify.com</span>\
          </div>\
        ';
        stateEl.querySelectorAll('.sample-chip').forEach(function(chip) {
          chip.onclick = function() {
            var d = chip.getAttribute('data-domain');
            urlInput.value = d;
            executeSearch(d);
          };
        });
      }

      function showLoadingState(hostname) {
        gridEl.style.display = 'none';
        stateEl.style.display = 'flex';
        stateEl.innerHTML = '\
          <div class="form-image-spinner"></div>\
          <div class="state-title">Scanning ' + hostname + '...</div>\
          <div class="state-subtitle">Analyzing HTML &lt;head&gt;, manifests, touch icons & root assets</div>\
        ';
      }

      function showErrorState(msg) {
        gridEl.style.display = 'none';
        stateEl.style.display = 'flex';
        stateEl.innerHTML = '\
          <i class="material-icons">error_outline</i>\
          <div class="state-title">No icons found</div>\
          <div class="state-subtitle">' + (msg || 'Could not fetch icons from this URL. Please verify the URL or use the Upload button.') + '</div>\
        ';
      }

      function formatAspectRatio(w, h, isSvg) {
        if (isSvg && (!w || !h)) return 'Vector • 1:1';
        if (!w || !h) return '1:1';
        var ratio = w / h;
        var label = '1:1';
        if (Math.abs(ratio - 1) <= 0.05) label = '1:1';
        else if (Math.abs(ratio - 16 / 9) <= 0.05) label = '16:9';
        else if (Math.abs(ratio - 4 / 3) <= 0.05) label = '4:3';
        else if (Math.abs(ratio - 3 / 2) <= 0.05) label = '3:2';
        else if (Math.abs(ratio - 2 / 1) <= 0.05) label = '2:1';
        else if (Math.abs(ratio - 9 / 16) <= 0.05) label = '9:16';
        else label = ratio > 1 ? ratio.toFixed(1) + ':1' : '1:' + (1 / ratio).toFixed(1);

        return isSvg ? 'Vector • ' + w + '×' + h : label + ' • ' + w + '×' + h;
      }

      function computeQualityScore(w, h, isSvg) {
        if (isSvg) return 10000000 + (w * h || 500000);
        var pixels = (w || 0) * (h || 0);
        var ratio = (w && h) ? (w / h) : 1;
        var isSquare = Math.abs(ratio - 1) <= 0.05;
        // High-res square launcher icons prioritized
        var squareBonus = isSquare ? 3.0 : (ratio >= 0.7 && ratio <= 1.4 ? 1.8 : 0.8);
        return pixels * squareBonus;
      }

      function applyImageToStudio(item) {
        fetch(item.uri)
          .then(function(r) { return r.blob(); })
          .then(function(blob) {
            var file = new File([blob], item.name.replace(/[^\w.-]+/g, '_') + '.png', { type: blob.type || 'image/png' });
            var dt = new DataTransfer();
            dt.items.add(file);
            var dropEvent = new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt
            });
            dropTarget.dispatchEvent(dropEvent);
          });
      }

      var currentSelectedUri = null;

      function renderGrid(items) {
        stateEl.style.display = 'none';
        gridEl.innerHTML = '';
        gridEl.style.display = 'grid';

        items.forEach(function(item, index) {
          var card = document.createElement('div');
          card.className = 'form-image-result-card' + (currentSelectedUri === item.uri ? ' is-selected' : '');
          card.title = item.name + ' (' + item.aspectRatioStr + ')';

          var thumb = document.createElement('div');
          thumb.className = 'form-image-card-thumb';
          var img = document.createElement('img');
          img.src = item.uri;
          img.alt = item.name;
          thumb.appendChild(img);
          card.appendChild(thumb);

          var nameEl = document.createElement('div');
          nameEl.className = 'form-image-card-name';
          nameEl.textContent = item.name;
          card.appendChild(nameEl);

          var ratioEl = document.createElement('div');
          ratioEl.className = 'form-image-card-ratio';
          ratioEl.textContent = item.aspectRatioStr;
          card.appendChild(ratioEl);

          if (index === 0) {
            var badgeEl = document.createElement('span');
            badgeEl.className = 'form-image-card-badge';
            badgeEl.textContent = 'Highest Quality';
            card.appendChild(badgeEl);
          }

          card.onclick = function() {
            currentSelectedUri = item.uri;
            gridEl.querySelectorAll('.form-image-result-card').forEach(function(c) { c.classList.remove('is-selected'); });
            card.classList.add('is-selected');
            applyImageToStudio(item);
          };

          gridEl.appendChild(card);
        });
      }

      async function executeSearch(rawInput) {
        var input = (rawInput || '').trim();
        if (!input) return;
        if (!/^https?:\/\//i.test(input)) input = 'https://' + input;

        var parsedUrl;
        try {
          parsedUrl = new URL(input);
        } catch (e) {
          showErrorState('Invalid URL format.');
          return;
        }

        var origin = parsedUrl.origin;
        var hostname = parsedUrl.hostname;
        var apexDomain = IconExtractor.getApexDomain(hostname);
        showLoadingState(hostname);

        var candidateList = [];
        var candidateColors = [];
        var isDirectImage = /\.(png|jpe?g|svg|webp|ico|gif)(\?.*)?$/i.test(parsedUrl.pathname);
        var isDirectManifest = /\.(json|webmanifest)(\?.*)?$/i.test(parsedUrl.pathname) || /manifest/i.test(parsedUrl.pathname);

        if (isDirectImage) {
          candidateList.push({ name: parsedUrl.pathname.split('/').pop() || 'Direct Image', url: input });
        } else if (isDirectManifest) {
          // Direct manifest URL (e.g. https://open.spotifycdn.com/cdn/generated/manifest-web-player.1609946b.json)
          var mText = await IconExtractor.fetchTextViaProxies(input);
          if (mText) {
            var mRes = IconExtractor.parseManifestJson(mText, input);
            if (mRes.colors && mRes.colors.length > 0) {
              candidateColors.push.apply(candidateColors, mRes.colors);
            }
            if (mRes.icons && mRes.icons.length > 0) {
              candidateList.push.apply(candidateList, mRes.icons);
            }
          }
          // Also include Tier 3 fallback paths from origin
          candidateList.push.apply(candidateList, IconExtractor.getComprehensiveRootPaths(origin));
        } else {
          // Launch all tiers concurrently for maximum responsiveness
          var tasks = [
            // Tier 1 & 2: HTML Head + Manifest Scraping (Icons + Colors)
            IconExtractor.fetchTextViaProxies(input).then(async function(htmlText) {
              var outIcons = [];
              if (htmlText) {
                var headRes = IconExtractor.parseHtmlHead(htmlText, input);
                var headIcons = headRes.icons || headRes;
                if (headRes.colors) candidateColors.push.apply(candidateColors, headRes.colors);

                var subFetches = [];
                headIcons.forEach(function(hi) {
                  if (hi.type === 'manifest') {
                    subFetches.push(IconExtractor.fetchTextViaProxies(hi.url).then(function(t) {
                      if (!t) return [];
                      var mRes = IconExtractor.parseManifestJson(t, hi.url);
                      if (mRes.colors) candidateColors.push.apply(candidateColors, mRes.colors);
                      return mRes.icons || mRes;
                    }));
                  } else if (hi.type === 'browserconfig') {
                    subFetches.push(IconExtractor.fetchTextViaProxies(hi.url).then(function(t) {
                      if (!t) return [];
                      var bcRes = IconExtractor.parseBrowserConfigXml(t, hi.url);
                      if (bcRes.colors) candidateColors.push.apply(candidateColors, bcRes.colors);
                      return bcRes.icons || bcRes;
                    }));
                  } else if (hi.type === 'yandex-manifest') {
                    subFetches.push(IconExtractor.fetchTextViaProxies(hi.url).then(function(t) {
                      return t ? IconExtractor.parseYandexManifestJson(t, hi.url) : [];
                    }));
                  } else {
                    outIcons.push(hi);
                  }
                });
                var subResults = await Promise.all(subFetches);
                subResults.forEach(function(r) { outIcons.push.apply(outIcons, r); });
              }
              return outIcons;
            }),

            // Tier 2: Direct Manifest & Config Fallback Paths
            IconExtractor.fetchTextViaProxies(origin + '/manifest.json').then(function(t) {
              if (!t) return [];
              var mRes = IconExtractor.parseManifestJson(t, origin + '/manifest.json');
              if (mRes.colors) candidateColors.push.apply(candidateColors, mRes.colors);
              return mRes.icons || mRes;
            }),
            IconExtractor.fetchTextViaProxies(origin + '/site.webmanifest').then(function(t) {
              if (!t) return [];
              var mRes = IconExtractor.parseManifestJson(t, origin + '/site.webmanifest');
              if (mRes.colors) candidateColors.push.apply(candidateColors, mRes.colors);
              return mRes.icons || mRes;
            }),
            IconExtractor.fetchTextViaProxies(origin + '/browserconfig.xml').then(function(t) {
              if (!t) return [];
              var bcRes = IconExtractor.parseBrowserConfigXml(t, origin + '/browserconfig.xml');
              if (bcRes.colors) candidateColors.push.apply(candidateColors, bcRes.colors);
              return bcRes.icons || bcRes;
            }),

            // Headless Scraper via Microlink API
            fetchWithTimeout('https://api.microlink.io/?url=' + encodeURIComponent(input), {}, 4000)
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(json) {
                var list = [];
                if (json && json.data) {
                  if (json.data.logo && json.data.logo.url) list.push({ name: 'Brand Logo', url: json.data.logo.url });
                  if (json.data.image && json.data.image.url) list.push({ name: 'Social Card', url: json.data.image.url });
                  if (json.data.icon && json.data.icon.url) list.push({ name: 'Site Icon', url: json.data.icon.url });
                }
                return list;
              }).catch(function() { return []; }),

            // Tier 3: Comprehensive Root Paths
            Promise.resolve(IconExtractor.getComprehensiveRootPaths(origin)),

            // Tier 4: Subdomain & Apex Traversal
            Promise.resolve((apexDomain && apexDomain !== hostname) ? [
              { name: 'Apex Apple Touch Icon', url: 'https://' + apexDomain + '/apple-touch-icon.png' },
              { name: 'Apex Android Chrome 512', url: 'https://' + apexDomain + '/android-chrome-512x512.png' },
              { name: 'Apex Favicon SVG', url: 'https://' + apexDomain + '/favicon.svg' },
              { name: 'Apex Favicon ICO', url: 'https://' + apexDomain + '/favicon.ico' },
              { name: 'Apex Favicon 32', url: 'https://' + apexDomain + '/favicon-32x32.png' }
            ] : []),

            // Tier 5: Third-Party Aggregators
            Promise.resolve([
              { name: 'App Icon (HD)', url: 'https://icon.horse/icon/' + hostname },
              { name: 'Brand Icon', url: 'https://unavatar.io/' + hostname },
              {
                name: 'Google Favicon',
                url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=' + encodeURIComponent(origin) + '&size=256'
              },
              {
                name: 'Google S2 Favicon',
                url: 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(hostname) + '&sz=256'
              },
              {
                name: 'DuckDuckGo Favicon',
                url: 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(hostname) + '.ico'
              }
            ])
          ];

          var results = await Promise.all(tasks);
          results.forEach(function(r) { candidateList.push.apply(candidateList, r); });
        }

        // Deduplicate and process website brand colors
        var uniqueColorsMap = {};
        candidateColors.forEach(function(c) {
          if (!c.hex) return;
          var hex = c.hex.toLowerCase();
          if (!uniqueColorsMap[hex]) {
            uniqueColorsMap[hex] = { hex: hex, label: c.label, source: c.source };
          } else if (uniqueColorsMap[hex].label !== c.label) {
            uniqueColorsMap[hex].label = uniqueColorsMap[hex].label + ' / ' + c.label;
          }
        });
        var websiteColorsList = Object.values(uniqueColorsMap);
        window.assetStudioWebsiteColors = websiteColorsList;
        if (window.assetStudioBgColorSuggester && typeof window.assetStudioBgColorSuggester.setWebsiteColors === 'function') {
          window.assetStudioBgColorSuggester.setWebsiteColors(websiteColorsList);
        }

        // Deduplicate URLs before fetching
        var seenUrls = new Set();
        var uniqueCandidates = [];
        candidateList.forEach(function(c) {
          if (!c.url || seenUrls.has(c.url)) return;
          seenUrls.add(c.url);
          uniqueCandidates.push(c);
        });

        // Parallel resolution to base64 Data URIs
        var seenKeys = new Set();
        var loadedItems = [];

        await Promise.all(uniqueCandidates.map(async function(c) {
          try {
            var dataUri = await IconExtractor.fetchAsDataUri(c.url);
            if (!dataUri) return;
            var key = dataUri.substring(0, 120) + ':' + dataUri.length;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            var isSvg = c.url.toLowerCase().indexOf('.svg') >= 0 || dataUri.indexOf('data:image/svg+xml') === 0;
            var img = new Image();
            await new Promise(function(resolve, reject) {
              img.onload = resolve;
              img.onerror = reject;
              img.src = dataUri;
            });

            var w = img.naturalWidth || 0;
            var h = img.naturalHeight || 0;

            // Reject tracking pixels and tiny broken icons
            if (w < 16 || h < 16) return;

            // Detect Google S2 fallback generic 16x16 globe
            if (c.url.indexOf('google.com/s2/favicons') >= 0 && w === 16 && h === 16) return;

            var aspectRatioStr = formatAspectRatio(w, h, isSvg);
            var qualityScore = computeQualityScore(w, h, isSvg);

            loadedItems.push({
              name: c.name,
              uri: dataUri,
              isSvg: isSvg,
              width: w,
              height: h,
              aspectRatioStr: aspectRatioStr,
              qualityScore: qualityScore
            });
          } catch(e) {}
        }));

        if (!loadedItems || loadedItems.length === 0) {
          showErrorState('No icons or images could be retrieved from ' + hostname + '.');
          return;
        }

        // Sort by highest quality first (SVGs and square high-res icons at top)
        loadedItems.sort(function(a, b) { return b.qualityScore - a.qualityScore; });

        renderGrid(loadedItems);
        currentSelectedUri = loadedItems[0].uri;
        applyImageToStudio(loadedItems[0]);
      }

      function updateActiveMode() {
        var isImage = imageRadio.checked;
        imageParamsEl.classList.toggle('is-hidden', !isImage);
        var parent = imageParamsEl.parentElement;
        if (parent && isImage) {
          var clipartEl = parent.querySelector('.form-image-type-params-clipart');
          var textEl = parent.querySelector('.form-image-type-params-text');
          if (clipartEl) clipartEl.classList.add('is-hidden');
          if (textEl) textEl.classList.add('is-hidden');
        }
      }

      imageRadio.addEventListener('change', updateActiveMode);
      clipartRadio.addEventListener('change', updateActiveMode);
      textRadio.addEventListener('change', updateActiveMode);

      searchBtn.onclick = function() { executeSearch(urlInput.value); };
      urlInput.onkeydown = function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSearch(urlInput.value);
        }
      };

      fileInput.addEventListener('change', function() {
        if (fileInput.files && fileInput.files[0]) {
          var f = fileInput.files[0];
          var reader = new FileReader();
          reader.onload = function(e) {
            var dataUri = e.target.result;
            var isSvg = f.type === 'image/svg+xml';
            var img = new Image();
            img.onload = function() {
              var w = img.naturalWidth || 0;
              var h = img.naturalHeight || 0;
              var uploaded = {
                name: f.name,
                uri: dataUri,
                isSvg: isSvg,
                width: w,
                height: h,
                aspectRatioStr: formatAspectRatio(w, h, isSvg),
                qualityScore: 99999999
              };
              currentSelectedUri = uploaded.uri;
              renderGrid([uploaded]);
              applyImageToStudio(uploaded);
            };
            img.src = dataUri;
          };
          reader.readAsDataURL(f);
        }
      });

      updateActiveMode();
      showInitialState();
    }

    initStudioEnhancement();
  });
})();
