import path from 'path';
import dayjs from 'dayjs';
import cheerio from 'cheerio';
import { getOptions } from 'loader-utils';

import replaceAt from '../utils/replace-at';
import trimChar from '../utils/trim-char';

const libHTMLOptions = {
  xmlMode: true
};

export function insertBreaks(source) {
  let preTeg = source.indexOf('<pre');

  while (preTeg !== -1) {
    let endPreTag = source.indexOf('</pre>', preTeg);
    let newLine = source.indexOf('\n', preTeg);

    do {
      newLine = source.indexOf('\n', preTeg);
      endPreTag = source.indexOf('</pre>', preTeg);
      source = replaceAt(source, '\n', '<br />', newLine);
    } while (
      source.indexOf('\n', preTeg) < endPreTag &&
      newLine !== source.indexOf('\n', preTeg) &&
      newLine !== -1
    );

    preTeg = source.indexOf('<pre', endPreTag);
  }

  return source;
}

export const regexIndexOf = function(string, regex, startpos) {
  const indexOf = string.substring(startpos || 0).search(regex);
  return indexOf >= 0 ? indexOf + (startpos || 0) : indexOf;
};

const replaceAll = (source, regex, search = {}, replace = {}) => {
  let indexOnPage = regexIndexOf(source, regex);

  while (indexOnPage !== -1) {
    source = replaceAt(source, search.start, replace.start, indexOnPage);

    if (search.end && source.indexOf(search.end, indexOnPage) > -1) {
      const nextTag = source.indexOf('<', indexOnPage + 1);
      const close = source.indexOf('/', indexOnPage);

      if (close > nextTag) {
        source = replaceAt(
          source,
          search.end,
          replace.end,
          source.indexOf(search.end, indexOnPage)
        );
      }
    }

    indexOnPage = regexIndexOf(source, regex, indexOnPage);
  }

  return source;
};

export const replaceIdLinks = source => {
  source = replaceAll(
    source,
    /<a href="#(?!\/)[\S]+/,
    {
      start: '<a href="#',
      end: '</a>'
    },
    {
      start:
        '<OptionalLink currentPage={(this && this.props || props).currentPage} to="#',
      end: '</OptionalLink>'
    }
  );
  source = replaceAll(
    source,
    /<a className="fas fa-hashtag headerLink" href="#(?!\/)[\S]+/,
    {
      start: '<a className="fas fa-hashtag headerLink" href="#',
      end: '</a>'
    },
    {
      start:
        '<OptionalLink currentPage={(this && this.props || props).currentPage} className="fas fa-hashtag headerLink" to="#',
      end: '</OptionalLink>'
    }
  );

  return source;
};

export function sanitizeJSX(source) {
  if (source.includes('<pre')) {
    source = insertBreaks(source);
  }

  // Some of the curlies need to stay to pass props to the plugin component
  source = source.replace(new RegExp('!{', 'g'), '__CURLY_LEFT__');
  source = source.replace(new RegExp('!}', 'g'), '__CURLY_RIGHT__');

  // Don't break the JSX
  // source = source.replace(new RegExp('`', 'g'), '\\`');
  source = source.replace(new RegExp('{', 'g'), '&#123;');
  source = source.replace(new RegExp('}', 'g'), '&#125;');

  // Need to escape br for jsx
  source = source.replace(new RegExp('<br>', 'g'), '<br/>');

  source = source.replace(new RegExp('__CURLY_LEFT__', 'g'), '{');
  source = source.replace(new RegExp('__CURLY_RIGHT__', 'g'), '}');

  // Uppercase to use as react component
  source = source.replace(new RegExp('pluginprovider', 'g'), 'PluginProvider');
  source = source.replace(new RegExp('details', 'g'), 'Details');

  // Use Bulma Checkboxes
  source = source.replace(
    new RegExp('<div class="checkbox', 'g'),
    '<div class="field'
  );
  source = source.replace(
    new RegExp('<label for="checkbox', 'g'),
    '<label htmlFor="field'
  );
  source = source.replace(
    new RegExp('<input type="checkbox"', 'g'),
    '<input type="checkbox" readOnly class="is-checkradio"'
  );

  source = source.replace(
    new RegExp('<a href="http', 'g'),
    '<a target="_blank" href="http'
  );

  source = source.replace(
    new RegExp('highlighted-line', 'g'),
    'highlighted-line hero is-primary'
  );

  source = source.replace(
    new RegExp('<a target="_blank" href', 'g'),
    '<OptionalLink currentPage={(this && this.props || props).currentPage} target="_blank" to'
  );
  source = source.replace(
    new RegExp('<a href', 'g'),
    '<OptionalLink currentPage={(this && this.props || props).currentPage} to'
  );
  source = source.replace(
    new RegExp('<a ', 'g'),
    '<OptionalLink currentPage={(this && this.props || props).currentPage} '
  );
  source = source.replace(new RegExp('href', 'g'), 'to');
  source = source.replace(
    new RegExp('<a>', 'g'),
    '<OptionalLink currentPage={(this && this.props || props).currentPage} to="">'
  );
  source = source.replace(new RegExp('</a>', 'g'), '</OptionalLink>');

  // React uses className
  source = source.replace(new RegExp('class=', 'g'), 'className=');
  source = replaceIdLinks(source, /<a href="#(?!\/)[\S]+/);

  source = source.replace(new RegExp('img', 'g'), 'LazyImageComponent');

  return source;
}

export function getLink(source, index = 0) {
  const linkIndex = source.indexOf('<a h', index);

  if (linkIndex === -1) {
    return { index: -1, link: '' };
  }

  const hrefIndex = source.indexOf('href="', linkIndex);
  const endIndex = source.indexOf('"', hrefIndex + 6);
  const startIndex = source.indexOf('/', hrefIndex) + 1;

  return {
    link:
      source.substring(linkIndex, linkIndex + 10) === '<a href=""' ||
      startIndex > endIndex
        ? ''
        : source.substring(startIndex, endIndex),
    index: linkIndex
  };
}

export function addActive(source, link, firstLink, indexFile, options) {
  indexFile = indexFile.replace('.md', '.html');
  source = source.replace(
    new RegExp('<a h'),
    `<a className=!{
        '/${link}' === props.currentPage || 
        ('${firstLink.link}' === '${link}' && ('${
      options.baseURL
    }' === props.currentPage ||
        '/${indexFile}' === props.currentPage)) ||
        ('${
          firstLink.link
        }' === '${link}' && props.currentPage && (props.currentPage.includes('${indexFile}') || !props.currentPage.includes('.html'))) 
          ? 'is-active'
          : null
        !}
        h`
  );

  return source;
}

export function addActiveAll(source, firstLink, indexFile, options) {
  let { link, index } = getLink(source);

  while (index !== -1) {
    source = addActive(source, link, firstLink, indexFile, options);
    ({ link, index } = getLink(source, index + 1));
  }

  return source;
}

export function codeTabs(source) {
  const codeTabsComponents = [];
  let start = source.indexOf('<CodeTabs>');
  let index = 0;

  while (start !== -1) {
    const endString = '</CodeTabs>';
    let end = source.indexOf('</CodeTabs>', start);
    let html = source.substring(start, end + endString.length);

    html = html.replace('CodeTabs', 'div className="codeTabs"');
    html = html.replace('CodeTabs', 'div');

    codeTabsComponents.push(`
      class CodeTabs${index} extends React.Component {
        state = {
          tabIndex: 0
        }

        onClick = tabIndex => () => {
          this.setState({
            tabIndex
          })
        }

        render() {
          return (
            ${sanitizeJSX(html)}
          )
        }
      }
    `);

    source =
      source.slice(0, start) +
      `<CodeTabs${index} />` +
      source.slice(end + endString.length);
    end = source.indexOf(`<CodeTabs${index} />`, start);
    start = source.indexOf('<CodeTabs>', end);
    index += 1;
  }

  return {
    source,
    codeTabsComponent: codeTabsComponents.join('\n')
  };
}

function getSources(markup) {
  const srcRegex = /src="([\S]+)"/g;
  const sources = [];

  let match = srcRegex.exec(markup);

  while (match) {
    sources.push(match[1]);
    match = srcRegex.exec(markup);
  }

  return sources;
}

export const initPage = (rawSource, options) => {
  const { codeTabsComponent, source } = codeTabs(rawSource);
  const imageSources = getSources(rawSource).map(
    src =>
      `'${src}': () => ${
        src.includes('//')
          ? `{ src:'${src}' }`
          : `import('${src.replace('images', './images')}')`
      },`
  );

  return {
    pageStart: `
      import path from 'path';
      import React, { Component } from 'react';
      import makeClass from 'classnames';
      import { Link } from '@reach/router';
      import Gist from 'react-gist';
      import TweetEmbed from 'react-tweet-embed'

      const imageSources = { ${imageSources.join('')} };

      const OptionalLink = ({ currentPage, ...props }) => props.to
        ? <Link {...props} currentPage={currentPage} />
        : <a { ...props} />;

      const PluginProvider = ({plugins, name, options, children}) => {
        let Plugin = plugins[name];
        const pluginOptions = Plugin.options;

        if (!Plugin) {
          return <div />;
        }

        Plugin = Plugin.component;
        return (
          <Plugin
            {...pluginOptions} 
            children={children}
            {...options.props}
            options={options.options}
          />
        );
      };

      class Details extends Component {
        state = {
          open: this.props.open
        }

        render() {
          return (
            <details open={this.state.open}>
              {this.props.children}
            </details>
          )
        }
      }

      ${codeTabsComponent}

      import IdealImage from 'react-ideal-image'

      class LazyImageComponent extends React.Component {
        state = {
          image: null,
          ImageProvider: imageSources[this.props.src]
        }

        componentDidMount() {
          if (!this.state.image) {
            this.state.ImageProvider().then(c => {
              this.setState({
                image: c.default
              });
            });
          }
        }

        render() {
          let { image } = this.state;

          return image ? (
            <IdealImage
              placeholder={{lqip:image.preSrc}}
              srcSet={[{src: image.src, width: image.width}]}
              src={image.src}
              alt={this.props.alt}
              width={image.width}
              height={image.height}
            />
          ) : null;
        }
      }
    `,
    source
  };
};

export const createStubAndPost = (source, pathToMarkdown, options) => {
  const date = options.blogPosts
    ? (options.blogPosts.find(post => post.path === pathToMarkdown) || {}).birth
    : '';
  const card = `
  <div class="card">
    <div class="card-content">
      <div class="blogBody">
        
      </div>
    </div>
  </div>    
`;
  const $source = cheerio.load(`<div>${source}</div>`, libHTMLOptions);
  const $fullPage = cheerio.load(card, libHTMLOptions);
  const $stub = cheerio.load(card, libHTMLOptions);
  const heroUrl = $source('#background-image')
    .remove()
    .text();

  $source('.blogSubtitle').append(
    `<span> on ${dayjs(date).format('MMMM D, YYYY')}<span/>`
  );
  $stub('.card-content').prepend($source('.media').clone());
  $fullPage('.card-content').prepend($source('.media').clone());
  $source('.media').remove();

  $source('div')
    .clone()
    .children()
    .map((i, el) =>
      $stub('.blogBody').append(
        i < 3
          ? el
          : i === 4 &&
            `
      <div class='has-text-centered learnMore'>
        <Link to='${path.join(
          options.baseURL,
          pathToMarkdown.replace('.md', '.html')
        )}'>
          Read More
        </Link>
      </div>
    `
      )
    );

  $fullPage('.blogBody').append($source.html());

  return {
    heroUrl,
    stub: $stub.html(),
    post: $fullPage.html()
  };
};

export function blogPost(rawSource, pathToMarkdown, options) {
  const { pageStart, source } = initPage(rawSource, options);
  let { heroUrl, stub, post } = createStubAndPost(
    source,
    pathToMarkdown,
    options
  );

  post = sanitizeJSX(post);
  stub = sanitizeJSX(stub);

  return `
    ${pageStart}

    class blogPost extends React.Component {
      componentDidMount() {
        if (!this.props.atIndex) {
          window.configuration.setBlogHero('${heroUrl.trim()}');
        }
      }

      render() {
        return  (
          <div className={makeClass('blogPost', this.props.className)}>
            <p>{this.props.heroUrl}</p>
            <section>
              {this.props.stub ? ${stub} : ${post}}
            </section>
          </div>
        );
      }
    }

    export default blogPost;
  `;
}

export function index(rawSource, pathToMarkdown, options) {
  let { pageStart, source } = initPage(rawSource, options);
  const firstLink = getLink(source);

  source = addActiveAll(source, firstLink, options.index, options);
  source = sanitizeJSX(source);
  source = source.replace(
    new RegExp('<ul>', 'g'),
    '<ul className="menu-list">'
  );
  source = source.replace(new RegExp('<p>', 'g'), '<p className="menu-label">');

  return `
    ${pageStart}

    export default function index(props) {
      return (
        <aside className={makeClass('menu', props.className)} onClick={props.onClick}>
          ${source}
        </aside>
      );
    }

    window.configuration.setFirstLink('${
      options.watch
        ? path.join('/', pathToMarkdown)
        : path.join(options.baseURL, pathToMarkdown)
    }', '${path.join('/', firstLink.link.replace('.html', '.md'))}');
  `;
}

export function markDownPage(rawSource, options) {
  let { pageStart, source } = initPage(rawSource, options);

  source = sanitizeJSX(source);

  return `
    ${pageStart}

    const markDownPage = props => (
      <div className={props.className}>
        <section>
          ${source}
        </section>
      </div>
    );

    export default markDownPage;
  `;
}

export function homePage(rawSource, options) {
  let { pageStart, source } = initPage(rawSource, options);

  const $source = cheerio.load(
    `<div class="source">${source}</div>`,
    libHTMLOptions
  );
  const $homePage = cheerio.load(
    `<div class="homePage"></div>`,
    libHTMLOptions
  );

  const contentRow =
    '<div class="columns"><div class="home column content is-two-thirds-tablet is-three-quarters-desktop"></div></div>';
  let $currentRow;

  while ($source('.source > :first-child').length > 0) {
    const isHero = $source('.source > :first-child').hasClass('hero');
    const $element = $source.html('.source > :first-child');
    $source('.source > :first-child').remove();

    if (isHero) {
      if ($currentRow && $currentRow('.home.column').children().length > 0) {
        $homePage('.homePage').append($currentRow.html());
      }

      $currentRow = cheerio.load(contentRow, libHTMLOptions);
      $homePage('.homePage').append($element);
    } else {
      $currentRow('.home.column').append($element);
    }
  }

  source = sanitizeJSX($homePage.html());

  return `
    ${pageStart}

    const homePage = props => (
      <div>
        ${source}
      </div>
    );

    export default homePage;
  `;
}

export function detectIndex(resourcePath, pathToMarkdown, options) {
  return (
    resourcePath.includes(options.index) &&
    (!options.navItems ||
      Object.values(options.navItems)
        .map(item => {
          return item === '/'
            ? options.index
            : path.join(trimChar(item, '/'), options.index);
        })
        .includes(pathToMarkdown))
  );
}

export default function(source) {
  const options = getOptions(this);
  const pathToMarkdown = path.relative(options.src, this.resourcePath);

  if (pathToMarkdown === 'home.md') {
    return homePage(source, options);
  }

  if (this.resourcePath.includes(path.join(options.src, 'blog/'))) {
    return blogPost(source, pathToMarkdown, options);
  }

  if (detectIndex(this.resourcePath, pathToMarkdown, options)) {
    return index(source, pathToMarkdown, options);
  }

  return markDownPage(source, options);
}
