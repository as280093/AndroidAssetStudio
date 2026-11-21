/*
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import $ from 'jquery';
import WebFont from 'webfontloader';

import {Form} from './form';
import {Field} from './field';
import {TextField} from './text-field';
import {RangeField} from './range-field';
import {BooleanField} from './boolean-field';
import {EnumField} from '.';

import {Util} from '../util';

import * as studio from '../index';

import {CLIPART_NAMES} from './image-field-clipart';


const WEB_FONTS_API_KEY = 'AIzaSyCzONJUtzxRRszF7MyNLE_qGE8fsmwaNRk';
const WEB_FONTS_API_URL = `https://www.googleapis.com/webfonts/v1/webfonts?key=${WEB_FONTS_API_KEY}&fields=items(family)`;
const WEB_FONTS_CACHE_TIME = 60 * 60 * 1000; // 1 hour


/**
 * Represents a form field for image values.
 */
export class ImageField extends Field {
  constructor(id, params) {
    super(id, params);
    this.valueType_ = null;
    this.textParams_ = {};
    this.imageParams_ = {};
    this.clipartSrc_ = null;
    this.lastNotifiedValue_ = {};
    this.spaceFormValues_ = {}; // cache
    this.fetchedImages_ = [];
    this.selectedFetchedImage_ = null;
  }

  createUi(container) {
    var fieldUI = super.createUi(container);
    var fieldContainer = $('.form-field-container', fieldUI);

    // Set up drag+drop on the entire field container
    fieldUI.addClass('form-field-image');
    // Drop target bound to imageParamsEl after it is created below

    // Create radio buttons
    this.el_ = $('<div>')
        .attr('id', this.getHtmlId())
        .addClass('form-field-buttonset')
        .appendTo(fieldContainer);

    var types;
    if (this.params_.imageOnly) {
      types = [
        ['image', 'Select image']
      ];
    } else {
      types = [
        ['image', 'Image'],
        ['clipart', 'Clipart'],
        ['text', 'Text']
      ];
    }

    var typeEls = {};

    types.forEach(([id, label]) => {
      $('<input>')
          .attr({
            type: 'radio',
            name: this.getHtmlId(),
            id: `${this.getHtmlId()}-${id}`,
            value: id
          })
          .appendTo(this.el_);
      typeEls[id] = $('<label>')
          .attr('for', `${this.getHtmlId()}-${id}`)
          .attr('tabindex', 0)
          .text(label)
          .appendTo(this.el_);
    });

    // Prepare UI for the 'image' type
    this.fileEl_ = $('<input>')
        .addClass('form-image-hidden-file-field')
        .attr({
          id: this.getHtmlId(),
          type: 'file',
          accept: 'image/*'
        })
        .on('change', () => this.loadImage_(this.fileEl_.get(0).files))
        .appendTo(this.el_);

    typeEls.image.click(evt => {
      this.setValueType_('image');
      this.renderValueAndNotifyChanged_();
    });

    let imageParamsEl = $('<div>')
        .addClass('form-image-type-params form-image-type-params-image is-hidden')
        .appendTo(fieldContainer);

    let urlBarEl = $('<div>')
        .addClass('form-image-url-bar')
        .appendTo(imageParamsEl);

    let urlInputEl = $('<input>')
        .addClass('form-image-url-input')
        .attr({
          type: 'text',
          placeholder: 'Enter website URL (e.g. google.com) or image link',
          spellcheck: 'false'
        })
        .appendTo(urlBarEl);

    let urlSearchBtn = $('<button>')
        .addClass('form-image-url-search-btn')
        .attr({
          type: 'button',
          title: 'Fetch icons from URL'
        })
        .html('<i class="material-icons">arrow_forward</i>')
        .appendTo(urlBarEl);

    let triggerFetch = () => {
      let val = urlInputEl.val().trim();
      if (val) {
        this.fetchImagesFromUrl_(val);
      }
    };

    urlSearchBtn.click(triggerFetch);
    urlInputEl.on('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        triggerFetch();
      }
    });

    let actionToolbarEl = $('<div>')
        .addClass('form-image-action-toolbar')
        .appendTo(imageParamsEl);

    $('<button>')
        .addClass('form-image-upload-btn')
        .attr('type', 'button')
        .html('<i class="material-icons">file_upload</i> Upload image')
        .click(() => this.fileEl_.trigger('click'))
        .appendTo(actionToolbarEl);

    let quickSamplesEl = $('<div>')
        .addClass('form-image-quick-samples')
        .html(`
          <span class="sample-label">Try:</span>
          <span class="sample-chip" data-domain="google.com">google.com</span>
          <span class="sample-chip" data-domain="github.com">github.com</span>
          <span class="sample-chip" data-domain="spotify.com">spotify.com</span>
          <span class="sample-chip" data-domain="apple.com">apple.com</span>
        `)
        .appendTo(actionToolbarEl);

    quickSamplesEl.find('.sample-chip').click(ev => {
      let domain = $(ev.currentTarget).data('domain');
      urlInputEl.val(domain);
      this.fetchImagesFromUrl_(domain);
    });

    this.imageResultsContainerEl_ = $('<div>')
        .addClass('form-image-results-container cancel-parent-scroll is-hidden')
        .appendTo(imageParamsEl);

    this.imageGridEl_ = $('<div>')
        .addClass('form-image-grid')
        .appendTo(this.imageResultsContainerEl_);

    this.imageStateEl_ = $('<div>')
        .addClass('form-image-state-message')
        .appendTo(this.imageResultsContainerEl_);

    this.imageFooterEl_ = $('<div>')
        .addClass('form-image-footer is-hidden')
        .appendTo(imageParamsEl);

    let bgSelectorEl = $('<div>')
        .addClass('form-image-bg-selector')
        .html(`
          <span class="bg-selector-label">Bg:</span>
          <div class="bg-swatches">
            <button type="button" class="bg-swatch is-active" data-bg="checker" title="Checkerboard (Transparent)"></button>
            <button type="button" class="bg-swatch" data-bg="#ffffff" title="Light / White" style="background-color: #ffffff;"></button>
            <button type="button" class="bg-swatch" data-bg="#212121" title="Dark / Charcoal" style="background-color: #212121;"></button>
            <button type="button" class="bg-swatch" data-bg="#1976d2" title="Vivid Blue" style="background-color: #1976d2;"></button>
            <button type="button" class="bg-swatch" data-bg="#009688" title="Vivid Teal" style="background-color: #009688;"></button>
            <button type="button" class="bg-swatch" data-bg="#ff9800" title="Vivid Amber" style="background-color: #ff9800;"></button>
            <label class="bg-swatch bg-swatch-custom" title="Custom color">
              <input type="color" value="#673ab7" class="bg-color-picker-input">
            </label>
          </div>
        `)
        .appendTo(this.imageFooterEl_);

    $('<div>')
        .addClass('form-image-footer-meta')
        .html('<span>Sorted by highest quality</span>')
        .appendTo(this.imageFooterEl_);

    let setBackdrop = (bgValue, isCustom) => {
      bgSelectorEl.find('.bg-swatch').removeClass('is-active');
      let activeSwatch = isCustom
        ? bgSelectorEl.find('.bg-swatch-custom')
        : bgSelectorEl.find(`.bg-swatch[data-bg="${bgValue}"]`);
      activeSwatch.addClass('is-active');

      let dynStyle = $('#dynamic-thumb-style');
      if (!dynStyle.length) {
        dynStyle = $('<style id="dynamic-thumb-style">').appendTo('head');
      }

      if (bgValue === 'checker') {
        this.imageResultsContainerEl_.css({
          '--thumb-bg': '#fff',
          '--thumb-pattern': 'linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)'
        });
        dynStyle.text('.form-image-card-thumb { background-color: #fff !important; background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%) !important; }');
      } else {
        this.imageResultsContainerEl_.css({
          '--thumb-bg': bgValue,
          '--thumb-pattern': 'none'
        });
        dynStyle.text(`.form-image-card-thumb { background-color: ${bgValue} !important; background-image: none !important; }`);
      }

      try {
        localStorage.setItem('assetStudioThumbBg', bgValue);
      } catch (e) {}
    };

    bgSelectorEl.find('.bg-swatch:not(.bg-swatch-custom)').click(ev => {
      ev.preventDefault();
      let bg = $(ev.currentTarget).attr('data-bg');
      setBackdrop(bg, false);
    });

    let customColorInput = bgSelectorEl.find('.bg-color-picker-input');
    customColorInput.on('input change', ev => {
      setBackdrop($(ev.currentTarget).val(), true);
    });

    try {
      let savedBg = localStorage.getItem('assetStudioThumbBg');
      if (savedBg) {
        let isCustomColor = savedBg.startsWith('#') && !bgSelectorEl.find(`.bg-swatch[data-bg="${savedBg}"]`).length;
        if (isCustomColor) customColorInput.val(savedBg);
        setBackdrop(savedBg, isCustomColor);
      }
    } catch (e) {}

    this.renderImageInitialState_(urlInputEl);

    // Prepare UI for the 'clipart' type
    if (!this.params_.imageOnly) {
      let clipartParamsEl = $('<div>')
          .addClass('form-image-type-params form-image-type-params-clipart is-hidden')
          .appendTo(fieldContainer);

      let clipartListEl = $('<div>')
          .addClass('form-image-clipart-list')
          .addClass('cancel-parent-scroll')
          .appendTo(clipartParamsEl);

      CLIPART_NAMES.forEach(clipartSrc => {
        $('<div>')
            .addClass('form-image-clipart-item')
            .attr('data-name', clipartSrc)
            .attr('title', clipartSrc)
            .text(clipartSrc)
            .click(() => this.loadClipart_(clipartSrc))
            .appendTo(clipartListEl);
      });

      this.$clipartItems = clipartListEl.find('.form-image-clipart-item');

      let clipartFilterEl = $('<input>')
        .addClass('form-image-clipart-filter')
        .attr('placeholder', 'Find clipart')
        .on('input', ev => {
          let $filter = $(ev.currentTarget);
          let val = $filter.val().toLowerCase().replace(/[^\w]+/g, '');
          if (!val) {
            this.$clipartItems.show();
          } else {
            this.$clipartItems.each((_, item) => {
              $(item).toggle($(item).attr('title').indexOf(val) >= 0);
            });
          }
        })
        .prependTo(clipartParamsEl);

      var clipartAttributionEl = $('<div>')
          .addClass('form-image-clipart-attribution')
          .html(`
              For clipart sources, visit
              <a target="_blank"
                 class="external-link"
                 href="https://github.com/google/material-design-icons">
              Material Design Icons on GitHub</a>
              `)
          .appendTo(clipartParamsEl);

      typeEls.clipart.click(evt => {
        this.setValueType_('clipart');
        this.renderValueAndNotifyChanged_();
      });

      // Prepare UI for the 'text' type
      var textParamsEl = $('<div>')
          .addClass('form-subform form-image-type-params form-image-type-params-text is-hidden')
          .appendTo(fieldContainer);

      let fontFamilyField;
      this.textForm_ = new Form({
        id: `${this.form_.id_}-${this.id_}-textform`,
        container: textParamsEl,
        fields: [
          new TextField('text', {
            title: 'Text',
          }),
          (fontFamilyField = new EnumField('font', {
            title: 'Font',
            helpText: 'From fonts.google.com'
          }))
        ]
      });
      this.loadGoogleWebFontsList_().then(fonts => fontFamilyField.setOptions([''].concat(fonts)));

      let tryLoadWebFontDebounced_ = Util.debounce(500, () => this.tryLoadWebFont_());
      this.textForm_.onChange(() => {
        var values = this.textForm_.getValues();
        this.textParams_.text = values.text;
        this.textParams_.fontStack = values.font || 'Roboto, sans-serif';
        tryLoadWebFontDebounced_();
        this.renderValueAndNotifyChanged_();
      });

      typeEls.text.click(evt => {
        this.setValueType_('text');
        this.renderValueAndNotifyChanged_();
      });
    }

    // Create spacing subform
    if (!this.params_.noTrimForm) {
      let spaceFormContainer = $('<div>')
          .addClass('form-subform')
          .appendTo(fieldContainer);
      this.spaceFormValues_ = {};
      this.spaceForm_ = new Form({
        id: `${this.form_.id_}-${this.id_}-spaceform`,
        container: spaceFormContainer,
        fields: [
          (this.spaceFormTrimField_ = new BooleanField('trim', {
            title: 'Trim whitespace',
            defaultValue: true,
            offText: `Don't trim`,
            onText: 'Trim'
          })),
          (this.spaceFormPaddingField_ = new RangeField('pad', {
            title: 'Padding',
            defaultValue: this.params_.defaultValuePadding || 0,
            min: -0.1,
            max: 0.5, // 1/2 of min(width, height)
            step: 0.05,
            textFn(v) {
              return (v * 100).toFixed(0) + '%';
            }
          })),
        ]
      });
      this.spaceForm_.onChange(() => {
        this.spaceFormValues_ = this.spaceForm_.getValues();
        this.renderValueAndNotifyChanged_();
      });
      this.spaceFormValues_ = this.spaceForm_.getValues();
    } else {
      this.spaceFormValues_ = {};
    }

    // Create image preview element
    if (!this.params_.noPreview) {
      this.imagePreview_ = $('<canvas>')
          .addClass('form-image-preview')
          .hide()
          .appendTo(fieldContainer.parent());
    }

    if (this.params_.defaultValueClipart) {
      setTimeout(() => {
        if (!this.valueType_) {
          this.loadClipart_(this.params_.defaultValueClipart);
        }
      }, 0);
    }
  }

  setupDropTarget_(el) {
    let target = (this.params_.dropTarget && this.params_.dropTarget !== document.body && this.params_.dropTarget !== document)
        ? this.params_.dropTarget
        : el;
    let $el = $(target);
    let enterLeaveTimeout;

    $el
        .addClass('form-field-drop-target')
        .on('dragenter', ev => {
          ev.preventDefault();
          if (enterLeaveTimeout) {
            clearTimeout(enterLeaveTimeout);
            enterLeaveTimeout = null;
          }
          $el.addClass('drag-hover');
        })
        .on('dragleave', ev => {
          ev.preventDefault();
          if (enterLeaveTimeout) {
            clearTimeout(enterLeaveTimeout);
          }
          enterLeaveTimeout = setTimeout(() => $el.removeClass('drag-hover'), 100);
        })
        .on('dragover', ev => {
          ev.preventDefault();
          if (enterLeaveTimeout) {
            clearTimeout(enterLeaveTimeout);
            enterLeaveTimeout = null;
          }
          ev.originalEvent.dataTransfer.dropEffect = 'copy';
        })
        .on('drop', ev => {
          $el.removeClass('drag-hover');
          ev.stopPropagation();
          ev.preventDefault();
          this.loadImage_(ev.originalEvent.dataTransfer.files);
        });
  }

  loadImage_(fileList) {
    ImageField.loadImageFromFileList(fileList).then(ret => {
      if (!ret) {
        return;
      }

      this.setValueType_('image');
      this.imageParams_ = ret;
      this.imageFilename_ = ret.name.replace(/\.[^.]+?$/, ''); // basename

      Util.loadImageFromUri(ret.uri).then(img => {
        let w = img.naturalWidth || 0;
        let h = img.naturalHeight || 0;
        let aspect = ImageField.formatAspectRatio(w, h, ret.isSvg);
        let uploadedItem = {
          name: ret.name,
          uri: ret.uri,
          isSvg: ret.isSvg,
          width: w,
          height: h,
          aspectRatioStr: aspect,
          qualityScore: 9999999
        };
        this.fetchedImages_ = [uploadedItem].concat(
          (this.fetchedImages_ || []).filter(item => item.name !== uploadedItem.name)
        );
        this.renderImageGrid_(this.fetchedImages_);
        this.selectFetchedImage_(uploadedItem);
      }).catch(() => {
        this.renderValueAndNotifyChanged_();
      });
    });
  }

  renderImageInitialState_(urlInputEl) {
    if (!this.imageGridEl_ || !this.imageStateEl_) return;
    this.imageGridEl_.empty().hide();
    this.imageStateEl_.empty().show().html(`
      <i class="material-icons">image_search</i>
      <div class="state-title">Fetch icons from any website</div>
      <div class="state-subtitle">Enter a website URL above or pick a sample:</div>
      <div class="quick-sample-chips">
        <span class="sample-chip" data-domain="google.com">google.com</span>
        <span class="sample-chip" data-domain="github.com">github.com</span>
        <span class="sample-chip" data-domain="apple.com">apple.com</span>
        <span class="sample-chip" data-domain="spotify.com">spotify.com</span>
      </div>
    `);

    this.imageStateEl_.find('.sample-chip').click(ev => {
      let domain = $(ev.currentTarget).data('domain');
      if (urlInputEl) {
        urlInputEl.val(domain);
      }
      this.fetchImagesFromUrl_(domain);
    });
  }

  renderImageLoadingState_(hostname) {
    if (this.imageResultsContainerEl_) this.imageResultsContainerEl_.removeClass('is-hidden');
    if (this.imageFooterEl_) this.imageFooterEl_.removeClass('is-hidden');
    if (!this.imageGridEl_ || !this.imageStateEl_) return;
    this.imageGridEl_.empty().hide();
    this.imageStateEl_.empty().show().html(`
      <div class="form-image-spinner"></div>
      <div class="state-title">Fetching icons from ${$('<div>').text(hostname).html()}...</div>
      <div class="state-subtitle">Extracting web manifest, touch icons, favicons & brand logos</div>
    `);
  }

  renderImageErrorState_(msg) {
    if (this.imageResultsContainerEl_) this.imageResultsContainerEl_.removeClass('is-hidden');
    if (this.imageFooterEl_) this.imageFooterEl_.removeClass('is-hidden');
    if (!this.imageGridEl_ || !this.imageStateEl_) return;
    this.imageGridEl_.empty().hide();
    this.imageStateEl_.empty().show().html(`
      <i class="material-icons">error_outline</i>
      <div class="state-title">No icons found</div>
      <div class="state-subtitle">${$('<div>').text(msg || 'Could not fetch icons from this URL. Please verify the URL or use the Upload button.').html()}</div>
    `);
  }

  renderImageGrid_(images) {
    if (this.imageResultsContainerEl_) this.imageResultsContainerEl_.removeClass('is-hidden');
    if (this.imageFooterEl_) this.imageFooterEl_.removeClass('is-hidden');
    if (!this.imageGridEl_ || !this.imageStateEl_) return;
    this.imageStateEl_.hide();
    this.imageGridEl_.empty().show();

    images.forEach((item, index) => {
      let card = $('<div>')
          .addClass('form-image-result-card')
          .attr('title', `${item.name} (${item.aspectRatioStr})`);

      if (this.selectedFetchedImage_ && this.selectedFetchedImage_.uri === item.uri) {
        card.addClass('is-selected');
      }

      let thumb = $('<div>')
          .addClass('form-image-card-thumb')
          .appendTo(card);

      $('<img>')
          .attr('src', item.uri)
          .attr('alt', item.name)
          .appendTo(thumb);

      $('<div>')
          .addClass('form-image-card-name')
          .text(item.name)
          .appendTo(card);

      $('<div>')
          .addClass('form-image-card-ratio')
          .text(item.aspectRatioStr)
          .appendTo(card);

      if (index === 0) {
        $('<span>')
            .addClass('form-image-card-badge')
            .text('Highest Quality')
            .appendTo(card);
      }

      card.click(() => this.selectFetchedImage_(item));
      card.appendTo(this.imageGridEl_);
    });
  }

  selectFetchedImage_(item) {
    this.selectedFetchedImage_ = item;
    if (this.imageGridEl_) {
      this.imageGridEl_.find('.form-image-result-card').removeClass('is-selected');
      this.imageGridEl_.find(`.form-image-result-card[title*="${item.name}"]`).addClass('is-selected');
    }

    this.setValueType_('image');
    this.imageParams_ = {
      uri: item.uri,
      isSvg: item.isSvg,
      name: item.name
    };
    this.imageFilename_ = item.name.replace(/\.[^.]+?$/, '');
    this.renderValueAndNotifyChanged_();
  }

  async fetchImagesFromUrl_(rawInput) {
    let input = (rawInput || '').trim();
    if (!input) return;

    if (!/^https?:\/\//i.test(input)) {
      input = 'https://' + input;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(input);
    } catch (e) {
      this.renderImageErrorState_('Invalid URL format. Please enter a valid URL.');
      return;
    }

    let origin = parsedUrl.origin;
    let hostname = parsedUrl.hostname;
    let apexDomain = ImageField.getApexDomain(hostname);

    this.renderImageLoadingState_(hostname);

    let isDirectImage = /\.(png|jpe?g|svg|webp|ico|gif)(\?.*)?$/i.test(parsedUrl.pathname);
    let candidateList = [];

    if (isDirectImage) {
      let name = parsedUrl.pathname.split('/').pop() || 'Direct Image';
      candidateList.push({ name, url: input });
    } else {
      // Launch all tiers concurrently for maximum responsiveness
      let tasks = [
        // Tier 1 & 2: HTML Head + Manifest Scraping
        ImageField.fetchTextViaProxies(input).then(async htmlText => {
          let out = [];
          if (htmlText) {
            let headIcons = ImageField.parseHtmlHead(htmlText, input);
            let subFetches = [];
            headIcons.forEach(hi => {
              if (hi.type === 'manifest') {
                subFetches.push(ImageField.fetchTextViaProxies(hi.url).then(t => {
                  return t ? ImageField.parseManifestJson(t, hi.url) : [];
                }));
              } else if (hi.type === 'browserconfig') {
                subFetches.push(ImageField.fetchTextViaProxies(hi.url).then(t => {
                  return t ? ImageField.parseBrowserConfigXml(t, hi.url) : [];
                }));
              } else if (hi.type === 'yandex-manifest') {
                subFetches.push(ImageField.fetchTextViaProxies(hi.url).then(t => {
                  return t ? ImageField.parseYandexManifestJson(t, hi.url) : [];
                }));
              } else {
                out.push(hi);
              }
            });
            let subResults = await Promise.all(subFetches);
            subResults.forEach(r => out.push(...r));
          }
          return out;
        }),

        // Tier 2: Manifest & Config Fallback Paths
        ImageField.fetchTextViaProxies(`${origin}/manifest.json`).then(t => {
          return t ? ImageField.parseManifestJson(t, `${origin}/manifest.json`) : [];
        }),
        ImageField.fetchTextViaProxies(`${origin}/site.webmanifest`).then(t => {
          return t ? ImageField.parseManifestJson(t, `${origin}/site.webmanifest`) : [];
        }),
        ImageField.fetchTextViaProxies(`${origin}/browserconfig.xml`).then(t => {
          return t ? ImageField.parseBrowserConfigXml(t, `${origin}/browserconfig.xml`) : [];
        }),

        // Headless Scraper via Microlink API
        ImageField.fetchWithTimeout(`https://api.microlink.io/?url=${encodeURIComponent(input)}`, {}, 4000)
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            let list = [];
            if (json && json.data) {
              if (json.data.logo && json.data.logo.url) list.push({ name: 'Brand Logo', url: json.data.logo.url });
              if (json.data.image && json.data.image.url) list.push({ name: 'Social Card', url: json.data.image.url });
              if (json.data.icon && json.data.icon.url) list.push({ name: 'Site Icon', url: json.data.icon.url });
            }
            return list;
          }).catch(() => []),

        // Tier 3: Comprehensive Root Paths
        Promise.resolve(ImageField.getComprehensiveRootPaths(origin)),

        // Tier 4: Subdomain & Apex Traversal
        Promise.resolve((apexDomain && apexDomain !== hostname) ? [
          { name: 'Apex Apple Touch Icon', url: `https://${apexDomain}/apple-touch-icon.png` },
          { name: 'Apex Android Chrome 512', url: `https://${apexDomain}/android-chrome-512x512.png` },
          { name: 'Apex Favicon SVG', url: `https://${apexDomain}/favicon.svg` },
          { name: 'Apex Favicon ICO', url: `https://${apexDomain}/favicon.ico` },
          { name: 'Apex Favicon 32', url: `https://${apexDomain}/favicon-32x32.png` }
        ] : []),

        // Tier 5: Third-Party Aggregators
        Promise.resolve([
          { name: 'App Icon (HD)', url: `https://icon.horse/icon/${hostname}` },
          { name: 'Brand Icon', url: `https://unavatar.io/${hostname}` },
          {
            name: 'Google Favicon',
            url: `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=256`
          },
          {
            name: 'Google S2 Favicon',
            url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=256`
          },
          {
            name: 'DuckDuckGo Favicon',
            url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`
          }
        ])
      ];

      let results = await Promise.all(tasks);
      results.forEach(r => candidateList.push(...r));
    }

    // Deduplicate URLs before fetching
    let seenUrls = new Set();
    let uniqueCandidates = [];
    for (let c of candidateList) {
      if (!c.url || seenUrls.has(c.url)) continue;
      seenUrls.add(c.url);
      uniqueCandidates.push(c);
    }

    ImageField.processCandidateUrls(uniqueCandidates).then(loadedImages => {
      if (!loadedImages || loadedImages.length === 0) {
        this.renderImageErrorState_(`No icons or images could be retrieved from ${hostname}.`);
        return;
      }

      // Sort by highest quality first
      loadedImages.sort((a, b) => b.qualityScore - a.qualityScore);

      this.fetchedImages_ = loadedImages;
      this.renderImageGrid_(loadedImages);
      this.selectFetchedImage_(loadedImages[0]);
    }).catch(err => {
      this.renderImageErrorState_(err.message || 'Error processing images.');
    });
  }

  loadGoogleWebFontsList_() {
    return new Promise((resolve, reject) => {
      if ('assetStudioWebFontsCache' in localStorage) {
        let {fetchTime, fonts} = JSON.parse(localStorage.assetStudioWebFontsCache);
        if (Number(new Date()) - fetchTime < WEB_FONTS_CACHE_TIME) {
          // use cache
          resolve(fonts);
          return;
        }
      }

      $.ajax({
        url: WEB_FONTS_API_URL,
        dataType: 'json'
      }).then(data => {
        let fonts = data.items.map(item => item.family);
        localStorage.assetStudioWebFontsCache = JSON.stringify({
          fetchTime: Number(new Date()),
          fonts
        });
        resolve(fonts);
      }, e => reject(e));
    });
  }

  tryLoadWebFont_() {
    let desiredFont = this.textForm_.getValues().font;
    if (this.loadedWebFont_ == desiredFont || !desiredFont) {
      return;
    }

    WebFont.load({
      google: {
        families: [desiredFont]
      },
      active: () => {
        this.loadedWebFont_ = desiredFont;
        this.renderValueAndNotifyChanged_();
      }
    });
  }

  setValueType_(type) {
    this.valueType_ = type;
    $('input', this.el_).prop('checked', false);
    $('.form-image-type-params', this.el_.parent()).addClass('is-hidden');
    if (type) {
      $(`#${this.getHtmlId()}-${type}`).prop('checked', true);
      $('.form-image-type-params-' + type, this.el_.parent()).removeClass('is-hidden');
    }

    if (this.spaceForm_) {
      this.spaceFormTrimField_.setEnabled(true);
      this.spaceFormPaddingField_.setEnabled(true);
      if (type == 'clipart') {
        if (this.params_.clipartNoTrimPadding) {
          this.spaceFormTrimField_.setEnabled(false);
          this.spaceFormTrimField_.setValue(false);
          this.spaceFormPaddingField_.setEnabled(false);
          this.spaceFormPaddingField_.setValue(0);
        }
      } else if (type == 'text') {
        this.spaceFormTrimField_.setEnabled(false);
        this.spaceFormTrimField_.setValue(true);
      }
    }
  }

  loadClipart_(clipartSrc) {
    this.$clipartItems.removeClass('is-selected');
    this.$clipartItems.filter(`[data-name="${clipartSrc}"]`).addClass('is-selected');

    this.setValueType_('clipart');
    this.clipartSrc_ = clipartSrc;
    this.renderValueAndNotifyChanged_();
  }

  clearValue() {
    this.valueType_ = null;
    this.valueCtx_ = null;
    this.valueOrigImg_ = null;
    this.fileEl_.val('');
    if (this.imagePreview_) {
      this.imagePreview_.hide();
    }
  }

  getValue() {
    let name = null;
    switch (this.valueType_) {
      case 'image':
        name = this.imageFilename_;
        break;

      case 'clipart':
        name = this.clipartSrc_;
        break;

      case 'text':
        name = this.textParams_.text;
        break;
    }

    return {
      ctx: this.valueCtx_,
      origImg: this.valueOrigImg_,
      type: this.valueType_,
      name
    };
  }

  notifyChanged_(newValue, oldValue) {
    super.notifyChanged_(newValue, oldValue);
    this.lastNotifiedValue_ = Object.assign({}, newValue);
  }

  // this function is asynchronous
  renderValueAndNotifyChanged_() {
    if (!this.valueType_) {
      this.valueCtx_ = null;
      this.valueOrigImg_ = null;
      this.notifyChanged_(this.getValue(), this.lastNotifiedValue_);
      return;
    }

    if (this.renderTimeout_) {
      clearTimeout(this.renderTimeout_);
      this.renderTimeout_ = null;
    }

    if (this.rendering_) {
      this.renderTimeout_ = setTimeout(
          () => this.renderValueAndNotifyChanged_(),
          100);
      return;
    }

    this.rendering_ = true;

    this.renderSource_()
        .then(({ctx, size}) => {
          this.computeTrimRect_(ctx, size)
              .then(trimRect => {
                let pad = this.spaceFormValues_.pad || 0;
                let padPx = Math.round(pad * Math.min(trimRect.w, trimRect.h));
                this.valueCtx_ = studio.Drawing.context({
                  w: trimRect.w + padPx * 2,
                  h: trimRect.h + padPx * 2
                });
                this.valueCtx_.drawImage(ctx.canvas,
                    trimRect.x, trimRect.y, trimRect.w, trimRect.h,
                    padPx, padPx, trimRect.w, trimRect.h);

                if (this.imagePreview_) {
                  this.imagePreview_.attr({
                    width: this.valueCtx_.canvas.width,
                    height: this.valueCtx_.canvas.height
                  });

                  let previewCtx = this.imagePreview_.get(0).getContext('2d');
                  previewCtx.drawImage(this.valueCtx_.canvas, 0, 0);
                  this.imagePreview_.show();
                }

                this.rendering_ = false;
                this.notifyChanged_(this.getValue(), this.lastNotifiedValue_);
              });
        }).catch(e => {
          console.error('Error: ' + e);
          this.rendering_ = false;
          this.notifyChanged_(this.getValue(), this.lastNotifiedValue_);
        });
  }

  renderSource_() {
    return new Promise((resolve, reject) => {
      // Render the base image (text, clipart, or image)
      switch (this.valueType_) {
        case 'image':
          if (this.imageParams_.uri) {
            Util.loadImageFromUri(this.imageParams_.uri)
                .then(img => {
                  this.valueOrigImg_ = img;
                  let origSize = {
                    w: img.naturalWidth,
                    h: img.naturalHeight
                  };
                  let size = Object.assign({}, origSize);
                  if (this.imageParams_.isSvg && this.params_.maxFinalSize) {
                    if (size.w / size.h > this.params_.maxFinalSize.w / this.params_.maxFinalSize.h) {
                      size.w = this.params_.maxFinalSize.w;
                      size.h = size.w * origSize.h / origSize.w;
                    } else {
                      size.h = this.params_.maxFinalSize.h;
                      size.w = size.h * origSize.w / origSize.h;
                    }
                  }
                  let ctx = studio.Drawing.context(size);
                  // don't specify source width and height because it breaks
                  // SVGs that don't have a width or height set (i.e. viewbox only)
                  // and is irrelevant for PNGs
                  ctx.drawImage(img,
                      // 0, 0, origSize.w, origSize.h,
                      0, 0, size.w, size.h);
                  resolve({ctx, size});
                });
          } else {
            reject('no uri');
          }
          break;

        case 'clipart':
          var size = { w: 1536, h: 1536 };
          var ctx = studio.Drawing.context(size);
          var text = this.clipartSrc_;

          ctx.fillStyle = '#000';
          ctx.font = `${size.h}px/${size.h}px 'Material Icons'`;
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(text, 0, size.h);

          resolve({ctx, size});
          break;

        case 'text':
          var size = { w: 6144, h: 1536 };
          var textHeight = size.h * 0.75;
          var ctx = studio.Drawing.context(size);
          var text = this.textParams_.text || '';
          text = ' ' + text + ' ';

          ctx.fillStyle = '#000';
          ctx.font = `bold ${textHeight}px/${size.h}px ${this.textParams_.fontStack}`;
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(text, 0, textHeight);
          size.w = Math.ceil(Math.min(ctx.measureText(text).width, size.w) || size.w);

          resolve({ctx, size});
          break;

        default:
          reject('No value type');
      }
    });
  }

  computeTrimRect_(ctx, size) {
    return new Promise((resolve, reject) => {
      if (this.spaceFormValues_.trim) {
        if (this.trimPromise_ && this.trimPromise_.worker) {
          this.trimPromise_.worker.terminate();
        }

        this.trimPromise_ = studio.Analysis.getTrimRect(ctx, size, 1)
            .then(trimRect => {
              let pad = Math.min(size.w, size.h) * .01;
              // pad a little bit to avoid edge artifacts
              Object.assign(trimRect, {
                x: Math.max(Math.floor(trimRect.x - pad), 0),
                y: Math.max(Math.floor(trimRect.y - pad), 0),
                w: Math.ceil(trimRect.w + pad * 2),
                h: Math.ceil(trimRect.h + pad * 2)
              });
              trimRect.w = Math.min(trimRect.w, size.w - trimRect.x);
              trimRect.h = Math.min(trimRect.h, size.h - trimRect.y);
              resolve(trimRect);
            }).catch(reject);
      } else {
        resolve({ x: 0, y: 0, w: size.w, h: size.h });
      }
    });
  }

  serializeValue() {
    let vals = {
      type: this.valueType_,
      clipart: (this.valueType_ == 'clipart') ? this.clipartSrc_ : null,
      text: (this.valueType_ == 'text') ? this.textForm_.getValuesSerialized() : null
    };

    if (this.spaceForm_) {
      vals.space = this.spaceForm_.getValuesSerialized();
    }

    return vals;
  }

  deserializeValue(o) {
    if (o.type) {
      this.setValueType_(o.type);
    }
    if (o.space) {
      this.spaceForm_.setValuesSerialized(o.space);
      this.spaceFormValues_ = this.spaceForm_.getValues();
    }
    if (o.clipart && this.valueType_ == 'clipart') {
      this.loadClipart_(o.clipart);
    }
    if (o.text && this.valueType_ == 'text') {
      this.textForm_.setValuesSerialized(o.text);
      this.tryLoadWebFont_();
    }
  }
}

/**
 * Loads the first valid image from a FileList (e.g. drag + drop source), as a data URI. This method
 * will throw an alert() in case of errors and call back with null.
 * @param {FileList} fileList The FileList to load.
 * @return Returns a promise, with object containing 'uri' field representing
 *      the loaded image. There will also be a 'name' field indicating the file name, if one
 *      is available.
 */
ImageField.loadImageFromFileList = function(fileList) {
  return new Promise((resolve, reject) => {
    fileList = fileList || [];

    let file = Array.from(fileList).find(file => ImageField.isValidFile_(file));

    if (!file) {
      alert('Please choose a valid image file (PNG, JPG, GIF, SVG, etc.)');
      resolve(null);
      return;
    }

    let isSvg = file.type == 'image/svg+xml';

    let fileReader = new FileReader();

    // Closure to capture the file information.
    fileReader.onload = e => resolve({
      isSvg,
      uri: e.target.result,
      name: file.name
    });

    fileReader.onerror = e => {
      switch (e.target.error.code) {
        case e.target.error.NOT_FOUND_ERR:
          alert('File not found!');
          break;

        case e.target.error.NOT_READABLE_ERR:
          alert('File is not readable');
          break;

        case e.target.error.ABORT_ERR:
          break; // noop

        default:
          alert('An error occurred reading this file.');
      }

      resolve(null);
    };

    fileReader.onabort = e => {
      alert('File read cancelled');
      resolve(null);
    };

    fileReader.readAsDataURL(file);
  });
};

ImageField.isValidFile_ = file => !!file.type.toLowerCase().match(/^image\//);

ImageField.GOOGLE_FALLBACK_GLOBE_BYTES = 726;

ImageField.getApexDomain = function(hostname) {
  if (!hostname) return '';
  let parts = hostname.toLowerCase().split('.');
  if (parts.length <= 2) return hostname;
  let secondLast = parts[parts.length - 2];
  if (['co', 'com', 'org', 'net', 'edu', 'gov'].includes(secondLast) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
};

ImageField.resolveUrl = function(relativeUrl, baseUrl) {
  if (!relativeUrl) return null;
  let trimmed = String(relativeUrl).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('//')) {
    let proto = baseUrl && baseUrl.startsWith('http:') ? 'http:' : 'https:';
    return proto + trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch (e) {
    return null;
  }
};

ImageField.parseHtmlHead = function(htmlText, baseUrl) {
  let icons = [];
  if (!htmlText || typeof htmlText !== 'string' || htmlText.length < 40) return icons;

  let docBase = baseUrl;
  let baseMatch = htmlText.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
  if (baseMatch && baseMatch[1]) {
    docBase = ImageField.resolveUrl(baseMatch[1], baseUrl) || baseUrl;
  }

  // Tier 1: Standard & Legacy <link> tags
  let linkRegex = /<link\s+([^>]+)>/gi;
  let match;
  while ((match = linkRegex.exec(htmlText)) !== null) {
    let attrsStr = match[1];
    let relMatch = attrsStr.match(/rel=["']([^"']+)["']/i);
    let hrefMatch = attrsStr.match(/href=["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;

    let relTokens = relMatch[1].toLowerCase().split(/\s+/);
    let rawHref = hrefMatch[1];
    let resolved = ImageField.resolveUrl(rawHref, docBase);
    if (!resolved) continue;

    let sizesMatch = attrsStr.match(/sizes=["']([^"']+)["']/i);
    let sizesStr = sizesMatch ? sizesMatch[1] : '';

    if (relTokens.includes('mask-icon')) {
      icons.push({ name: 'Safari Pinned Tab (SVG)', url: resolved, type: 'mask-icon', sizes: sizesStr });
    } else if (relTokens.includes('fluid-icon')) {
      icons.push({ name: 'Fluid High-Res Icon', url: resolved, type: 'fluid-icon', sizes: sizesStr });
    } else if (relTokens.includes('apple-touch-icon-precomposed')) {
      icons.push({ name: 'Apple Touch Precomposed', url: resolved, type: 'apple-touch-icon', sizes: sizesStr });
    } else if (relTokens.includes('apple-touch-icon')) {
      icons.push({ name: `Apple Touch Icon ${sizesStr}`.trim(), url: resolved, type: 'apple-touch-icon', sizes: sizesStr });
    } else if (relTokens.includes('image_src')) {
      icons.push({ name: 'Image Source Preview', url: resolved, type: 'image_src', sizes: sizesStr });
    } else if (relTokens.includes('icon') || (relTokens.includes('shortcut') && relTokens.includes('icon'))) {
      icons.push({ name: `Page Favicon ${sizesStr}`.trim(), url: resolved, type: 'icon', sizes: sizesStr });
    } else if (relTokens.includes('manifest')) {
      icons.push({ name: 'Web App Manifest', url: resolved, type: 'manifest' });
    } else if (relTokens.includes('yandex-tableau-widget')) {
      icons.push({ name: 'Yandex Tableau Manifest', url: resolved, type: 'yandex-manifest' });
    }
  }

  // Tier 1: Microsoft & Social Graph <meta> tags
  let metaRegex = /<meta\s+([^>]+)>/gi;
  while ((match = metaRegex.exec(htmlText)) !== null) {
    let mAttrsStr = match[1];
    let nameMatch = mAttrsStr.match(/(?:name|property)=["']([^"']+)["']/i);
    let contentMatch = mAttrsStr.match(/content=["']([^"']+)["']/i);
    if (!nameMatch || !contentMatch) continue;

    let propName = nameMatch[1].toLowerCase();
    let content = contentMatch[1].trim();
    if (!content || content.toLowerCase() === 'none') continue;
    let mResolved = ImageField.resolveUrl(content, docBase);
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

  return icons;
};

ImageField.parseManifestJson = function(manifestText, manifestUrl) {
  let icons = [];
  try {
    let data = JSON.parse(manifestText);
    if (Array.isArray(data.icons)) {
      // Prioritize purpose: "any" over "maskable"
      let sorted = [...data.icons].sort((a, b) => {
        let aAny = (a.purpose || 'any').includes('any');
        let bAny = (b.purpose || 'any').includes('any');
        if (aAny && !bAny) return -1;
        if (!aAny && bAny) return 1;
        return 0;
      });
      for (let icon of sorted) {
        if (!icon.src) continue;
        let resolved = ImageField.resolveUrl(icon.src, manifestUrl);
        if (resolved) {
          icons.push({ name: `Manifest Icon ${icon.sizes || ''}`.trim(), url: resolved, type: 'manifest-icon', sizes: icon.sizes });
        }
      }
    }
  } catch (e) {}
  return icons;
};

ImageField.parseBrowserConfigXml = function(xmlText, configUrl) {
  let icons = [];
  try {
    let regex = /<(TileImage|square70x70logo|square150x150logo|wide310x150logo|square310x310logo)[^>]*src=["']([^"']+)["']/gi;
    let match;
    while ((match = regex.exec(xmlText)) !== null) {
      let tag = match[1];
      let src = match[2];
      let resolved = ImageField.resolveUrl(src, configUrl);
      if (resolved) {
        icons.push({ name: `MS Tile (${tag})`, url: resolved, type: 'browserconfig-icon' });
      }
    }
  } catch (e) {}
  return icons;
};

ImageField.parseYandexManifestJson = function(jsonText, jsonUrl) {
  let icons = [];
  try {
    let data = JSON.parse(jsonText);
    if (data && data.layout && data.layout.logo) {
      let resolved = ImageField.resolveUrl(data.layout.logo, jsonUrl);
      if (resolved) {
        icons.push({ name: 'Yandex Tableau Logo', url: resolved, type: 'yandex-logo' });
      }
    }
  } catch (e) {}
  return icons;
};

ImageField.getComprehensiveRootPaths = function(origin) {
  return [
    // Modern & High-Res Formats
    { name: 'Favicon SVG', url: `${origin}/favicon.svg` },
    { name: 'App Router Icon SVG', url: `${origin}/icon.svg` },
    { name: 'App Router Icon PNG', url: `${origin}/icon.png` },
    { name: 'Apple Icon', url: `${origin}/apple-icon.png` },
    { name: 'Android Chrome 512', url: `${origin}/android-chrome-512x512.png` },
    { name: 'Android Chrome 192', url: `${origin}/android-chrome-192x192.png` },
    { name: 'Apple Touch Icon', url: `${origin}/apple-touch-icon.png` },
    { name: 'Apple Touch 180', url: `${origin}/apple-touch-icon-180x180.png` },
    { name: 'Apple Touch 152', url: `${origin}/apple-touch-icon-152x152.png` },
    { name: 'Apple Touch 120', url: `${origin}/apple-touch-icon-120x120.png` },
    { name: 'Apple Touch Precomposed', url: `${origin}/apple-touch-icon-precomposed.png` },

    // Standard & Mid-Era Desktop Paths
    { name: 'Favicon 96', url: `${origin}/favicon-96x96.png` },
    { name: 'Favicon 32', url: `${origin}/favicon-32x32.png` },
    { name: 'Favicon 16', url: `${origin}/favicon-16x16.png` },
    { name: 'Favicon PNG', url: `${origin}/favicon.png` },
    { name: 'MS Tile 150', url: `${origin}/mstile-150x150.png` },
    { name: 'MS Tile 310', url: `${origin}/mstile-310x310.png` },

    // Legacy 1990s-2000s Formats
    { name: 'Favicon ICO', url: `${origin}/favicon.ico` },
    { name: 'Favicon GIF', url: `${origin}/favicon.gif` },
    { name: 'Favicon JPG', url: `${origin}/favicon.jpg` },
    { name: 'Favicon JPEG', url: `${origin}/favicon.jpeg` },
    { name: 'Site Logo PNG', url: `${origin}/logo.png` },
    { name: 'Site Logo SVG', url: `${origin}/logo.svg` }
  ];
};

ImageField.parseIcoFrames = function(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 6) return null;
  let view = new DataView(arrayBuffer);
  let reserved = view.getUint16(0, true);
  let type = view.getUint16(2, true);
  let count = view.getUint16(4, true);
  if (reserved !== 0 || type !== 1 || count === 0) return null;

  let entries = [];
  for (let i = 0; i < count; i++) {
    let offset = 6 + i * 16;
    if (offset + 16 > arrayBuffer.byteLength) break;
    let w = view.getUint8(offset) || 256;
    let h = view.getUint8(offset + 1) || 256;
    let bpp = view.getUint16(offset + 6, true);
    let size = view.getUint32(offset + 8, true);
    let imgOffset = view.getUint32(offset + 12, true);

    let isPng = false;
    if (imgOffset + 8 <= arrayBuffer.byteLength) {
      let u8 = new Uint8Array(arrayBuffer, imgOffset, 8);
      if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
        isPng = true;
      }
    }
    entries.push({ w, h, bpp, size, imgOffset, isPng });
  }
  return entries;
};

ImageField.isSoft404 = function(blob, previewText) {
  if (!blob) return true;
  let type = (blob.type || '').toLowerCase();
  if (type.includes('text/html') || type.includes('text/plain')) {
    return true;
  }
  if (previewText) {
    let lower = previewText.toLowerCase().trim();
    if (lower.startsWith('<!doctype') || lower.startsWith('<html') || lower.startsWith('<head')) {
      return true;
    }
  }
  return false;
};

ImageField.fetchWithTimeout = function(url, options = {}, timeoutMs = 3500) {
  let controller = new AbortController();
  let id = setTimeout(() => controller.abort(), timeoutMs);
  let opts = Object.assign({}, options, { signal: controller.signal });
  return fetch(url, opts)
    .then(res => {
      clearTimeout(id);
      return res;
    })
    .catch(err => {
      clearTimeout(id);
      throw err;
    });
};

ImageField.fetchTextViaProxies = function(url) {
  return new Promise(resolve => {
    let settled = false;
    let finish = val => {
      if (!settled && val && val.length > 20) {
        settled = true;
        resolve(val);
      }
    };

    ImageField.fetchWithTimeout(url, { mode: 'cors' }, 2500)
      .then(r => r.ok ? r.text() : null)
      .then(finish).catch(() => {});

    ImageField.fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {}, 3500)
      .then(r => r.ok ? r.text() : null)
      .then(finish).catch(() => {});

    ImageField.fetchWithTimeout(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, {}, 3500)
      .then(r => r.ok ? r.text() : null)
      .then(finish).catch(() => {});

    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 3600);
  });
};

ImageField.processCandidateUrls = function(candidates) {
  let seenHashes = new Set();
  let promises = candidates.map(candidate => {
    return ImageField.fetchAsDataUri(candidate.url).then(dataUri => {
      if (!dataUri) return null;

      let uriKey = dataUri.substring(0, 120) + ':' + dataUri.length;
      if (seenHashes.has(uriKey)) return null;
      seenHashes.add(uriKey);

      let isSvg = (candidate.url || '').toLowerCase().includes('.svg') || dataUri.startsWith('data:image/svg+xml');

      return Util.loadImageFromUri(dataUri).then(img => {
        let width = img.naturalWidth || candidate.w || 0;
        let height = img.naturalHeight || candidate.h || 0;

        // Skip micro-tracking pixels or broken icons
        if (width < 16 || height < 16) return null;

        // Detect Google S2 fallback generic 16x16 globe
        if ((candidate.url || '').includes('google.com/s2/favicons') && width === 16 && height === 16) {
          return null;
        }

        let aspectRatioStr = ImageField.formatAspectRatio(width, height, isSvg);
        let qualityScore = ImageField.computeQualityScore(width, height, isSvg);

        return {
          name: candidate.name,
          uri: dataUri,
          isSvg,
          width,
          height,
          aspectRatioStr,
          qualityScore
        };
      }).catch(() => null);
    }).catch(() => null);
  });

  return Promise.all(promises).then(results => results.filter(item => !!item));
};

ImageField.fetchAsDataUri = async function(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  // 1. Try direct fetch with CORS first (fast timeout)
  try {
    let res = await ImageField.fetchWithTimeout(url, { mode: 'cors' }, 3000);
    if (res.ok) {
      let blob = await res.blob();
      if (blob.size > 0 && blob.size !== ImageField.GOOGLE_FALLBACK_GLOBE_BYTES) {
        let headSlice = await blob.slice(0, 100).text();
        if (!ImageField.isSoft404(blob, headSlice)) {
          // Check multi-resolution ICO
          if (url.toLowerCase().includes('.ico') || blob.type === 'image/x-icon') {
            let ab = await blob.arrayBuffer();
            let frames = ImageField.parseIcoFrames(ab);
            if (frames && frames.length > 0) {
              let largest = frames.reduce((prev, curr) => (curr.w * curr.h > prev.w * prev.h) ? curr : prev, frames[0]);
              if (largest.isPng) {
                let pngSlice = ab.slice(largest.imgOffset, largest.imgOffset + largest.size);
                let pngBlob = new Blob([pngSlice], { type: 'image/png' });
                return await ImageField.blobToDataUri(pngBlob);
              }
            }
          }
          return await ImageField.blobToDataUri(blob);
        }
      }
    }
  } catch (e) {}

  // 2. Fall back to wsrv.nl universal CORS image proxy
  try {
    let proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`;
    let res2 = await ImageField.fetchWithTimeout(proxyUrl, {}, 3500);
    if (res2.ok) {
      let blob2 = await res2.blob();
      if (blob2.size > 0 && blob2.size !== ImageField.GOOGLE_FALLBACK_GLOBE_BYTES) {
        let headSlice2 = await blob2.slice(0, 100).text();
        if (!ImageField.isSoft404(blob2, headSlice2)) {
          return await ImageField.blobToDataUri(blob2);
        }
      }
    }
  } catch (e) {}

  return null;
};

ImageField.blobToDataUri = function(blob) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

ImageField.formatAspectRatio = function(w, h, isSvg) {
  if (isSvg && (!w || !h)) {
    return 'Vector • 1:1';
  }
  if (!w || !h) {
    return '1:1';
  }

  let ratio = w / h;
  let label = '1:1';

  if (Math.abs(ratio - 1) <= 0.05) {
    label = '1:1';
  } else if (Math.abs(ratio - 16 / 9) <= 0.05) {
    label = '16:9';
  } else if (Math.abs(ratio - 4 / 3) <= 0.05) {
    label = '4:3';
  } else if (Math.abs(ratio - 3 / 2) <= 0.05) {
    label = '3:2';
  } else if (Math.abs(ratio - 2 / 1) <= 0.05) {
    label = '2:1';
  } else if (Math.abs(ratio - 9 / 16) <= 0.05) {
    label = '9:16';
  } else {
    label = ratio > 1 ? `${ratio.toFixed(1)}:1` : `1:${(1 / ratio).toFixed(1)}`;
  }

  if (isSvg) {
    return `Vector • ${w}×${h}`;
  }
  return `${label} • ${w}×${h}`;
};

ImageField.computeQualityScore = function(w, h, isSvg) {
  if (isSvg) {
    return 10000000 + (w * h || 500000);
  }
  let pixels = (w || 0) * (h || 0);
  let ratio = (w && h) ? (w / h) : 1;
  let isSquare = Math.abs(ratio - 1) <= 0.05;
  // Prioritize square launcher icons
  let squareBonus = isSquare ? 3.0 : (ratio >= 0.7 && ratio <= 1.4 ? 1.8 : 0.8);
  return pixels * squareBonus;
};

// Prevent outer page scrolling while scrolling inside scrollable lists, without trapping mousewheel
$(document).ready(() => {
  $(document).on('wheel mousewheel DOMMouseScroll', '.cancel-parent-scroll', function(e) {
    let el = this;
    let orig = e.originalEvent;
    let delta = orig.wheelDelta ? orig.wheelDelta : (orig.deltaY ? -orig.deltaY : -orig.detail);
    if (!delta) return;
    let up = delta > 0;
    let canScrollUp = el.scrollTop > 0;
    let canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    if ((up && canScrollUp) || (!up && canScrollDown)) {
      el.scrollTop -= delta;
      e.preventDefault();
    }
  });
});
