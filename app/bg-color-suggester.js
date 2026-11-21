/*
 * Android Asset Studio - Color Suggester
 * Generates high-contrast, harmonious background suggestions:
 * 1. Website Brand Colors (Extracted from manifest.json & meta tags)
 * 2. Corner Match (Inward Diagonal Raycasting for circular/badged icons)
 * 3. Material Tonal Palettes (Google @material/material-color-utilities HCT science)
 * 4. Curated Linear Gradients (Directional canvas rendering)
 */

(function(global) {
  'use strict';

  var MCU = global.MaterialColorUtils || {};

  function hexFromRgb(r, g, b) {
    var rx = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
    var gx = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
    var bx = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
    return '#' + rx + gx + bx;
  }

  function parseColorToRgb(str) {
    if (!str) return null;
    str = String(str).trim();
    if (str.indexOf('#') === 0) {
      var hex = str.slice(1);
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.substr(0, 2), 16),
          g: parseInt(hex.substr(2, 2), 16),
          b: parseInt(hex.substr(4, 2), 16)
        };
      }
    }
    var m = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      return {
        r: parseInt(m[1], 10),
        g: parseInt(m[2], 10),
        b: parseInt(m[3], 10)
      };
    }
    return null;
  }

  // 8-Point Inward Diagonal & Cardinal Raycasting
  function extractCornerColors(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    var w = canvas.width;
    var h = canvas.height;
    if (w <= 2 || h <= 2) return null;

    var sampleW = Math.min(w, 80);
    var sampleH = Math.min(h, 80);
    var offCanvas = document.createElement('canvas');
    offCanvas.width = sampleW;
    offCanvas.height = sampleH;
    var offCtx = offCanvas.getContext('2d');
    if (!offCtx) return null;

    offCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
    var imgData;
    try {
      imgData = offCtx.getImageData(0, 0, sampleW, sampleH).data;
    } catch (e) {
      return null;
    }

    function getPixel(x, y) {
      if (x < 0 || x >= sampleW || y < 0 || y >= sampleH) return null;
      var idx = (y * sampleW + x) * 4;
      return {
        r: imgData[idx],
        g: imgData[idx + 1],
        b: imgData[idx + 2],
        a: imgData[idx + 3]
      };
    }

    var cx = Math.floor(sampleW / 2);
    var cy = Math.floor(sampleH / 2);

    function raycast(startX, startY, endX, endY, maxFraction) {
      var maxSteps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
      var limit = Math.floor(maxSteps * (maxFraction || 0.75));
      for (var s = 0; s <= limit; s++) {
        var x = Math.round(startX + (endX - startX) * (s / maxSteps));
        var y = Math.round(startY + (endY - startY) * (s / maxSteps));
        var p = getPixel(x, y);
        if (p && p.a > 80) {
          return {
            x: x,
            y: y,
            r: p.r,
            g: p.g,
            b: p.b,
            hex: hexFromRgb(p.r, p.g, p.b),
            distFraction: s / maxSteps
          };
        }
      }
      return null;
    }

    var tl = raycast(0, 0, cx, cy, 0.75);
    var tr = raycast(sampleW - 1, 0, cx, cy, 0.75);
    var bl = raycast(0, sampleH - 1, cx, cy, 0.75);
    var br = raycast(sampleW - 1, sampleH - 1, cx, cy, 0.75);

    var top = raycast(cx, 0, cx, cy, 0.65);
    var bottom = raycast(cx, sampleH - 1, cx, cy, 0.65);
    var left = raycast(0, cy, cx, cy, 0.65);
    var right = raycast(sampleW - 1, cy, cx, cy, 0.65);

    var samples = [tl, tr, bl, br, top, bottom, left, right].filter(Boolean);
    if (samples.length < 3) return null;

    function colorDist(c1, c2) {
      return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
    }

    var clusters = [];
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var found = false;
      for (var j = 0; j < clusters.length; j++) {
        if (colorDist(clusters[j], s) <= 30) {
          clusters[j].count++;
          clusters[j].rSum += s.r;
          clusters[j].gSum += s.g;
          clusters[j].bSum += s.b;
          clusters[j].items.push(s);
          found = true;
          break;
        }
      }
      if (!found) {
        clusters.push({
          count: 1,
          r: s.r,
          g: s.g,
          b: s.b,
          rSum: s.r,
          gSum: s.g,
          bSum: s.b,
          items: [s]
        });
      }
    }

    clusters.sort(function(a, b) { return b.count - a.count; });
    var topCluster = clusters[0];
    var confidence = topCluster.count / samples.length;
    if (confidence < 0.50) return null;

    var avgR = Math.round(topCluster.rSum / topCluster.count);
    var avgG = Math.round(topCluster.gSum / topCluster.count);
    var avgB = Math.round(topCluster.bSum / topCluster.count);
    var dominantHex = hexFromRgb(avgR, avgG, avgB);

    return {
      dominantHex: dominantHex,
      confidence: confidence
    };
  }

  // Icon Palette Extraction
  function analyzeIcon(canvas, foreColor) {
    var foreRgb = parseColorToRgb(foreColor);
    var isSolidColorGlyph = foreRgb && foreColor !== 'transparent' && foreColor !== 'rgba(0, 0, 0, 0)';

    if (isSolidColorGlyph && MCU.argbFromRgb) {
      var argb = MCU.argbFromRgb(foreRgb.r, foreRgb.g, foreRgb.b);
      var hct = MCU.Hct ? MCU.Hct.fromInt(argb) : null;
      var tone = hct ? hct.tone : ((foreRgb.r * 299 + foreRgb.g * 587 + foreRgb.b * 114) / 1000) * 100 / 255;
      return { seedArgb: argb, seedHct: hct, isLightIcon: tone > 52 };
    }

    if (!canvas || !canvas.width || !canvas.height) {
      var defaultArgb = MCU.argbFromRgb ? MCU.argbFromRgb(68, 138, 255) : 0xff448aff;
      return { seedArgb: defaultArgb, seedHct: MCU.Hct ? MCU.Hct.fromInt(defaultArgb) : null, isLightIcon: false };
    }

    var sampleW = Math.min(canvas.width, 96);
    var sampleH = Math.min(canvas.height, 96);
    var offCanvas = document.createElement('canvas');
    offCanvas.width = sampleW;
    offCanvas.height = sampleH;
    var offCtx = offCanvas.getContext('2d');
    if (!offCtx) {
      var fbArgb = MCU.argbFromRgb ? MCU.argbFromRgb(68, 138, 255) : 0xff448aff;
      return { seedArgb: fbArgb, isLightIcon: false };
    }

    offCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
    var imgData;
    try {
      imgData = offCtx.getImageData(0, 0, sampleW, sampleH).data;
    } catch (e) {
      var fbArgb2 = MCU.argbFromRgb ? MCU.argbFromRgb(68, 138, 255) : 0xff448aff;
      return { seedArgb: fbArgb2, isLightIcon: false };
    }

    var pixels = [];
    var sumTone = 0;
    var opaqueCount = 0;
    var step = (sampleW * sampleH > 4000) ? 2 : 1;

    for (var y = 0; y < sampleH; y += step) {
      for (var x = 0; x < sampleW; x += step) {
        var idx = (y * sampleW + x) * 4;
        var a = imgData[idx + 3];
        if (a > 60) {
          var r = imgData[idx];
          var g = imgData[idx + 1];
          var b = imgData[idx + 2];
          var argbVal = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
          pixels.push(argbVal);
          sumTone += (r * 299 + g * 587 + b * 114) / 1000;
          opaqueCount++;
        }
      }
    }

    if (pixels.length === 0) {
      var defArgb = MCU.argbFromRgb ? MCU.argbFromRgb(68, 138, 255) : 0xff448aff;
      return { seedArgb: defArgb, isLightIcon: false };
    }

    var avgTone = (sumTone / opaqueCount) * (100 / 255);
    var isLightIcon = avgTone > 52;
    var seedArgb;

    if (MCU.QuantizerCelebi && MCU.Score) {
      try {
        var quantResult = MCU.QuantizerCelebi.quantize(pixels, 64);
        var scoredColors = MCU.Score.score(quantResult);
        seedArgb = (scoredColors && scoredColors.length > 0) ? scoredColors[0] : pixels[0];
      } catch (err) {
        seedArgb = pixels[0];
      }
    } else {
      seedArgb = pixels[0];
    }

    var seedHct = MCU.Hct ? MCU.Hct.fromInt(seedArgb) : null;
    return { seedArgb: seedArgb, seedHct: seedHct, isLightIcon: isLightIcon };
  }

  // Tonal Palette & Gradient Generation
  function generateM3Suggestions(analysis) {
    var Hct = MCU.Hct;
    var hexFromArgb = MCU.hexFromArgb;
    var isLightIcon = analysis.isLightIcon;
    var seedHct = analysis.seedHct;

    var seedHue = 250;
    var seedChroma = 36;

    if (seedHct && seedHct.chroma >= 8) {
      seedHue = seedHct.hue;
      seedChroma = seedHct.chroma;
    }

    function toHex(hctObj) {
      return hexFromArgb ? hexFromArgb(hctObj.toInt()) : '#448aff';
    }

    // 12 Solids
    var safeNeutral = isLightIcon ? '#18181B' : '#F8FAFC';
    var pureOpposite = isLightIcon ? '#000000' : '#FFFFFF';
    var pastelTint = toHex(Hct.from(seedHue, Math.min(Math.max(seedChroma, 24), 30), 92));
    var deepSurface = toHex(Hct.from(seedHue, Math.min(Math.max(seedChroma * 0.7, 16), 22), 16));
    var mutedNeutral = toHex(Hct.from(seedHue, 10, isLightIcon ? 22 : 88));
    var vibrantAccent = toHex(Hct.from(seedHue, Math.max(seedChroma, 52), isLightIcon ? 40 : 80));
    var compContrast = toHex(Hct.from((seedHue + 180) % 360, Math.max(seedChroma, 38), isLightIcon ? 25 : 85));
    var analogousShift = toHex(Hct.from((seedHue + 35) % 360, Math.max(seedChroma, 32), isLightIcon ? 30 : 85));
    var splitComp = toHex(Hct.from((seedHue + 150) % 360, Math.max(seedChroma, 36), isLightIcon ? 28 : 86));
    var triadic = toHex(Hct.from((seedHue + 120) % 360, Math.max(seedChroma, 38), isLightIcon ? 32 : 84));
    var oledMidnight = toHex(Hct.from(seedHue, 12, 8));
    var warmClay = toHex(Hct.from((seedHue + 25) % 360, 22, isLightIcon ? 28 : 90));

    // 8 Gradients
    var amb1 = toHex(Hct.from(seedHue, 22, 94));
    var amb2 = toHex(Hct.from((seedHue + 35) % 360, 20, 88));
    var softAmbient = { c1: amb1, c2: amb2, angle: 135, css: 'linear-gradient(135deg, ' + amb1 + ' 0%, ' + amb2 + ' 100%)' };

    var aur2 = toHex(Hct.from((seedHue + 325) % 360, 24, 12));
    var deepAurora = { c1: deepSurface, c2: aur2, angle: 135, css: 'linear-gradient(135deg, ' + deepSurface + ' 0%, ' + aur2 + ' 100%)' };

    var dusk2 = toHex(Hct.from((seedHue + 45) % 360, 48, isLightIcon ? 36 : 82));
    var sunsetDusk = { c1: vibrantAccent, c2: dusk2, angle: 135, css: 'linear-gradient(135deg, ' + vibrantAccent + ' 0%, ' + dusk2 + ' 100%)' };

    var bold2 = toHex(Hct.from(seedHue, Math.max(seedChroma, 48), isLightIcon ? 22 : 58));
    var boldExpressive = { c1: vibrantAccent, c2: bold2, angle: 135, css: 'linear-gradient(135deg, ' + vibrantAccent + ' 0%, ' + bold2 + ' 100%)' };

    var neo1 = toHex(Hct.from(seedHue, 50, isLightIcon ? 38 : 72));
    var neo2 = toHex(Hct.from((seedHue + 180) % 360, 52, isLightIcon ? 48 : 82));
    var neonDuotone = { c1: neo1, c2: neo2, angle: 135, css: 'linear-gradient(135deg, ' + neo1 + ' 0%, ' + neo2 + ' 100%)' };

    var frost1 = toHex(Hct.from(seedHue, 18, 95));
    var frost2 = toHex(Hct.from((seedHue + 120) % 360, 22, 91));
    var frostedGlass = { c1: frost1, c2: frost2, angle: 135, css: 'linear-gradient(135deg, ' + frost1 + ' 0%, ' + frost2 + ' 100%)' };

    var oledVelvet = { c1: oledMidnight, c2: deepSurface, angle: 180, css: 'linear-gradient(180deg, ' + oledMidnight + ' 0%, ' + deepSurface + ' 100%)' };

    var cos2 = toHex(Hct.from((seedHue + 150) % 360, 46, isLightIcon ? 32 : 70));
    var cosmicRadiance = { c1: vibrantAccent, c2: cos2, angle: 135, css: 'linear-gradient(135deg, ' + vibrantAccent + ' 0%, ' + cos2 + ' 100%)' };

    return [
      { id: 'safe-neutral', name: 'Safe Neutral', color: safeNeutral, desc: isLightIcon ? 'Charcoal' : 'Off-White' },
      { id: 'pure-opposite', name: 'Pure Contrast', color: pureOpposite, desc: isLightIcon ? 'Pure Black' : 'Pure White' },
      { id: 'pastel-tint', name: 'Pastel Tint', color: pastelTint, desc: 'Light surface tint' },
      { id: 'deep-surface', name: 'Deep Surface', color: deepSurface, desc: 'Dark surface tint' },
      { id: 'muted-neutral', name: 'Muted Neutral', color: mutedNeutral, desc: 'Tonal neutral' },
      { id: 'vibrant-accent', name: 'Vibrant Accent', color: vibrantAccent, desc: 'High-chroma accent' },
      { id: 'complementary', name: 'Complementary', color: compContrast, desc: 'Opposite hue' },
      { id: 'analogous', name: 'Analogous', color: analogousShift, desc: 'Adjacent hue' },
      { id: 'split-comp', name: 'Split-Complementary', color: splitComp, desc: 'Harmonic contrast' },
      { id: 'triadic', name: 'Triadic', color: triadic, desc: 'Triadic harmony' },
      { id: 'dark-oled', name: 'OLED Midnight', color: oledMidnight, desc: 'AMOLED pitch black' },
      { id: 'warm-clay', name: 'Warm Clay', color: warmClay, desc: 'Organic earth tone' },

      { id: 'soft-ambient', name: 'Soft Ambient', gradient: softAmbient, desc: 'Ambient light gradient', isGradient: true },
      { id: 'deep-aurora', name: 'Deep Aurora', gradient: deepAurora, desc: 'Dark aurora gradient', isGradient: true },
      { id: 'sunset-dusk', name: 'Sunset Dusk', gradient: sunsetDusk, desc: 'Chromatic glow', isGradient: true },
      { id: 'bold-expressive', name: 'Bold Expressive', gradient: boldExpressive, desc: 'Tonal gradient', isGradient: true },
      { id: 'neon-duotone', name: 'Neon Duotone', gradient: neonDuotone, desc: 'Duotone gradient', isGradient: true },
      { id: 'frosted-glass', name: 'Frosted Glass', gradient: frostedGlass, desc: 'Airy glass tint', isGradient: true },
      { id: 'oled-velvet', name: 'OLED Velvet', gradient: oledVelvet, desc: 'Vertical OLED fade', isGradient: true },
      { id: 'cosmic-radiance', name: 'Cosmic Radiance', gradient: cosmicRadiance, desc: 'Radiant split gradient', isGradient: true }
    ];
  }

  // Component Manager
  function BgColorSuggester() {
    this.generator = null;
    this.panelEl = null;
    this.swatchesContainer = null;
    this.infoBarEl = null;
    this.currentCornerData = null;
    this.websiteColors = [];
    this.activeItem = null;
  }

  BgColorSuggester.prototype.init = function(generator) {
    if (!generator) return;
    this.generator = generator;
    this.mountUi();
    this.attachEvents();
    this.refreshSuggestions();
  };

  BgColorSuggester.prototype.getFormField = function(fieldId) {
    if (!this.generator || !this.generator.form) return null;
    if (typeof this.generator.form.getField === 'function') {
      return this.generator.form.getField(fieldId);
    }
    var fields = this.generator.form.fields_ || [];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].id_ === fieldId) return fields[i];
    }
    return null;
  };

  BgColorSuggester.prototype.mountUi = function() {
    if (this.panelEl && document.body.contains(this.panelEl)) return;

    var backColorContainer = document.querySelector('#_frm-iconform-backColor');
    if (!backColorContainer) return;

    var formFieldOuter = backColorContainer.closest('.form-field-outer');
    if (!formFieldOuter) return;

    // Use standard Android Asset Studio form-field-outer structure
    this.panelEl = document.createElement('div');
    this.panelEl.id = 'bg-color-suggestions-container';
    this.panelEl.className = 'form-field-outer bg-color-suggestions-field';

    // Label with Title Case & help text matching Asset Studio design
    var labelEl = document.createElement('label');
    labelEl.innerHTML = 'Color suggestions<div class="form-field-help-text">Derived from website, image corners, and icon palette</div>';
    this.panelEl.appendChild(labelEl);

    var containerEl = document.createElement('div');
    containerEl.className = 'form-field-container';
    this.panelEl.appendChild(containerEl);

    // Grid for swatches (enlarged 36px buttons)
    this.swatchesContainer = document.createElement('div');
    this.swatchesContainer.className = 'bg-suggest-swatches-grid';
    containerEl.appendChild(this.swatchesContainer);

    // Informative Detail Bar (Inspector)
    this.infoBarEl = document.createElement('div');
    this.infoBarEl.className = 'bg-suggest-info-bar is-hidden';
    this.infoBarEl.innerHTML = [
      '<div class="bg-suggest-info-swatch"></div>',
      '<div class="bg-suggest-info-content">',
      '  <div class="bg-suggest-info-row-top">',
      '    <span class="bg-suggest-info-title"></span>',
      '    <span class="bg-suggest-info-code"></span>',
      '  </div>',
      '  <div class="bg-suggest-info-desc"></div>',
      '</div>'
    ].join('');
    containerEl.appendChild(this.infoBarEl);

    formFieldOuter.parentNode.insertBefore(this.panelEl, formFieldOuter.nextSibling);
  };

  BgColorSuggester.prototype.attachEvents = function() {
    if (!this.generator || !this.generator.form) return;
    var self = this;
    this.generator.form.onChange(function() {
      self.onFormChange();
    });
  };

  BgColorSuggester.prototype.onFormChange = function() {
    var self = this;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(function() {
      self.refreshSuggestions();
    }, 80);
  };

  BgColorSuggester.prototype.setWebsiteColors = function(colors) {
    this.websiteColors = colors || [];
    this.refreshSuggestions();
  };

  BgColorSuggester.prototype.updateInfoBar = function(item) {
    if (!this.infoBarEl) return;
    var swatchEl = this.infoBarEl.querySelector('.bg-suggest-info-swatch');
    var titleEl = this.infoBarEl.querySelector('.bg-suggest-info-title');
    var codeEl = this.infoBarEl.querySelector('.bg-suggest-info-code');
    var descEl = this.infoBarEl.querySelector('.bg-suggest-info-desc');

    if (!item) {
      this.infoBarEl.classList.add('is-hidden');
      this.infoBarEl.style.display = 'none';
      return;
    }

    this.infoBarEl.classList.remove('is-hidden');
    this.infoBarEl.style.display = 'flex';
    if (item.isGradient) {
      swatchEl.style.background = item.gradient.css;
      titleEl.textContent = item.name;
      codeEl.textContent = item.gradient.c1 + ' → ' + item.gradient.c2;
      descEl.textContent = item.desc || 'Curated gradient';
    } else {
      var colorVal = (item.color || item.hex || '').toUpperCase();
      swatchEl.style.background = colorVal;
      titleEl.textContent = item.name || item.label || 'Color';
      codeEl.textContent = colorVal;
      descEl.textContent = item.desc || 'Solid color';
    }
  };

  BgColorSuggester.prototype.refreshSuggestions = function() {
    if (!this.generator || !this.generator.form) return;
    this.mountUi();
    if (!this.swatchesContainer) return;

    var values = this.generator.form.getValues();
    var fg = values.foreground;
    var foreColor = values.foreColor;
    var canvas = fg && fg.ctx ? fg.ctx.canvas : null;

    // 1. Raycast Corner Detection
    var cornerData = extractCornerColors(canvas);
    this.currentCornerData = cornerData;

    // 2. Icon Palette Analysis
    var analysis = analyzeIcon(canvas, foreColor);

    // 3. Generate M3 Suggestions
    var suggestions = generateM3Suggestions(analysis);

    // 4. Render All Swatches in Single Unified Grid
    this.renderSwatches(cornerData, suggestions);
  };

  BgColorSuggester.prototype.clearActiveSwatch = function() {
    if (!this.swatchesContainer) return;
    var activeEls = this.swatchesContainer.querySelectorAll('.bg-suggest-swatch.is-active');
    for (var i = 0; i < activeEls.length; i++) {
      activeEls[i].classList.remove('is-active');
    }
  };

  BgColorSuggester.prototype.renderSwatches = function(cornerData, suggestions) {
    var self = this;
    this.swatchesContainer.innerHTML = '';

    var allItems = [];

    // 1. Website Brand Colors (Prepended with site globe badge)
    if (this.websiteColors && this.websiteColors.length > 0) {
      this.websiteColors.forEach(function(sc) {
        allItems.push({
          id: 'site-' + sc.hex.replace('#', ''),
          name: sc.label || 'Website Theme',
          color: sc.hex,
          desc: 'From ' + (sc.source || 'website'),
          badgeType: 'site',
          badgeIcon: 'public'
        });
      });
    }

    // 2. Corner Match Color (If detected)
    if (cornerData && cornerData.dominantHex) {
      allItems.push({
        id: 'corner-match',
        name: 'Corner Match',
        color: cornerData.dominantHex,
        desc: 'Matches outer icon edge',
        badgeType: 'corner',
        badgeIcon: 'crop_free'
      });
    }

    // 3. Curated Tonal Solids & Gradients
    suggestions.forEach(function(s) {
      if (s.isGradient) {
        s.badgeType = 'gradient';
        s.badgeIcon = 'gradient';
      }
      allItems.push(s);
    });

    // Render Swatch Buttons
    allItems.forEach(function(item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-suggest-swatch';
      var colorVal = item.color || item.hex;
      var titleText = item.name + ': ' + (colorVal || (item.gradient ? item.gradient.c1 + ' → ' + item.gradient.c2 : '')) + (item.desc ? ' (' + item.desc + ')' : '');
      btn.title = titleText;

      if (colorVal) {
        btn.setAttribute('data-color', colorVal.toLowerCase());
      }

      var innerHtml = [];
      if (item.isGradient) {
        btn.classList.add('bg-suggest-gradient');
        innerHtml.push('<span class="bg-suggest-swatch-fill" style="background: ' + item.gradient.css + '"></span>');
      } else {
        innerHtml.push('<span class="bg-suggest-swatch-fill" style="background-color: ' + colorVal + '"></span>');
      }

      if (item.badgeType) {
        innerHtml.push('<span class="bg-suggest-badge bg-badge-' + item.badgeType + '"><i class="material-icons">' + item.badgeIcon + '</i></span>');
      }

      btn.innerHTML = innerHtml.join('');

      // Mouse Hover -> Inspector Bar
      btn.addEventListener('mouseenter', function() {
        self.updateInfoBar(item);
      });

      btn.addEventListener('mouseleave', function() {
        if (self.activeItem) {
          self.updateInfoBar(self.activeItem);
        } else {
          self.updateInfoBar(null);
        }
      });

      // Click -> Apply Color
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        self.activeItem = item;
        if (item.isGradient) {
          self.applyGradient(item.gradient, btn);
        } else {
          self.applySolidColor(colorVal, btn);
        }
        self.updateInfoBar(item);
      });

      self.swatchesContainer.appendChild(btn);
    });

    this.updateActiveHighlight();
  };

  BgColorSuggester.prototype.updateActiveHighlight = function() {
    var backColorField = this.getFormField('backColor');
    if (!backColorField) return;

    var currentHex = backColorField.getValue().toHexString().toLowerCase();
    var isGradActive = window.assetStudioCustomGradient && window.assetStudioCustomGradient.active;

    this.clearActiveSwatch();

    if (!isGradActive && currentHex) {
      var matchBtn = this.swatchesContainer.querySelector('.bg-suggest-swatch[data-color="' + currentHex + '"]');
      if (matchBtn) {
        matchBtn.classList.add('is-active');
      }
    }
  };

  BgColorSuggester.prototype.applySolidColor = function(hexColor, buttonEl) {
    window.assetStudioCustomGradient = null;
    this.clearActiveSwatch();
    if (buttonEl) buttonEl.classList.add('is-active');

    var backColorField = this.getFormField('backColor');
    if (backColorField) {
      backColorField.setValue(hexColor);
    }
    if (typeof this.generator.regenerate === 'function') {
      this.generator.regenerate();
    }
  };

  BgColorSuggester.prototype.applyGradient = function(gradient, buttonEl) {
    window.assetStudioCustomGradient = {
      active: true,
      c1: gradient.c1,
      c2: gradient.c2,
      css: gradient.css,
      angle: gradient.angle || 135
    };

    this.clearActiveSwatch();
    if (buttonEl) buttonEl.classList.add('is-active');

    var backColorField = this.getFormField('backColor');
    if (backColorField) {
      backColorField.setValue(gradient.c1);
    }
    if (typeof this.generator.regenerate === 'function') {
      this.generator.regenerate();
    }
  };

  var instance = new BgColorSuggester();
  global.assetStudioBgColorSuggester = instance;

  function autoInit() {
    if (global.assetStudioCurrentGenerator) {
      instance.init(global.assetStudioCurrentGenerator);
    } else {
      var tries = 0;
      var interval = setInterval(function() {
        tries++;
        if (global.assetStudioCurrentGenerator) {
          clearInterval(interval);
          instance.init(global.assetStudioCurrentGenerator);
        } else if (tries > 50) {
          clearInterval(interval);
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

})(typeof window !== 'undefined' ? window : this);
