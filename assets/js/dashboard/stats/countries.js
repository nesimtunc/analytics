import React from 'react';
import Datamap from 'datamaps'
import { withRouter } from 'react-router-dom'

import numberFormatter from '../number-formatter'
import FadeIn from '../fade-in'
import LazyLoader from '../lazy-loader'
import MoreLink from './more-link'
import * as api from '../api'
import { navigateToQuery } from '../query'
import { withThemeConsumer } from '../theme-consumer-hoc';
import {apiPath, sitePath} from '../url'

import ListReport from './reports/list'

function Regions({query, site}) {
  function fetchData() {
    return api.get(apiPath(site, '/regions'), query, {country_name: query.filters.country, limit: 9})
  }

  return (
    <ListReport
      title="Regions"
      fetchData={fetchData}
      filter={{region: 'code', region_name: 'name'}}
      keyLabel="Region"
      detailsLink={sitePath(site, '/regions')}
      query={query}
    />
  )
}

function Cities({query, site}) {
  function fetchData() {
    return api.get(apiPath(site, '/cities'), query, {limit: 9})
  }

  return (
    <ListReport
      title="Cities"
      fetchData={fetchData}
      filter={{city: 'code', city_name: 'name'}}
      keyLabel="City"
      detailsLink={sitePath(site, '/cities')}
      query={query}
    />
  )
}

class Countries extends React.Component {
  constructor(props) {
    super(props)
    this.resizeMap = this.resizeMap.bind(this)
    this.drawMap = this.drawMap.bind(this)
    this.getDataset = this.getDataset.bind(this)
    this.state = {loading: true}
    this.onVisible = this.onVisible.bind(this)
  }

  componentDidUpdate(prevProps) {
    if (this.props.query !== prevProps.query) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({loading: true, countries: null})
      this.fetchCountries().then(this.drawMap)
    }

    if (this.props.darkTheme !== prevProps.darkTheme) {
      if (document.getElementById('map-container')) {
        document.getElementById('map-container').removeChild(document.querySelector('.datamaps-hoverover'));
        document.getElementById('map-container').removeChild(document.querySelector('.datamap'));
      }
      this.fetchCountries().then(this.drawMap)
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeMap);
  }

  onVisible() {
    this.fetchCountries().then(this.drawMap.bind(this))
    window.addEventListener('resize', this.resizeMap);
    if (this.props.timer) this.props.timer.onTick(this.updateCountries.bind(this))
  }

  getDataset() {
    const dataset = {};

    const onlyValues = this.state.countries.map((obj) => obj.count);
    const maxValue = Math.max.apply(null, onlyValues);

    // eslint-disable-next-line no-undef
    const paletteScale = d3.scale.linear()
      .domain([0,maxValue])
      .range([
        this.props.darkTheme ? "#2e3954" : "#f3ebff",
        this.props.darkTheme ? "#6366f1" : "#a779e9"
      ])

    this.state.countries.forEach((item) => {
      dataset[item.name] = {numberOfThings: item.count, fillColor: paletteScale(item.count)};
    })

    return dataset
  }

  updateCountries() {
    this.fetchCountries().then(() => {
      this.map.updateChoropleth(this.getDataset(), {reset: true})
    })
  }

  fetchCountries() {
    return api.get(`/api/stats/${encodeURIComponent(this.props.site.domain)}/countries`, this.props.query)
      .then((res) => this.setState({loading: false, countries: res}))
  }

  resizeMap() {
    this.map && this.map.resize()
  }

  drawMap() {
    const dataset = this.getDataset();
    const label = this.props.query.period === 'realtime' ? 'Current visitors' : 'Visitors'
    const defaultFill = this.props.darkTheme ? '#2d3747' : '#f8fafc'
    const highlightFill = this.props.darkTheme ? '#374151' : '#F5F5F5'
    const borderColor = this.props.darkTheme ? '#1f2937' : '#dae1e7'
    const highlightBorderColor = this.props.darkTheme ? '#4f46e5' : '#a779e9'

    this.map = new Datamap({
      element: document.getElementById('map-container'),
      responsive: true,
      projection: 'mercator',
      fills: { defaultFill },
      data: dataset,
      geographyConfig: {
        borderColor,
        highlightBorderWidth: 2,
        highlightFillColor: (geo) => geo.fillColor || highlightFill,
        highlightBorderColor,
        popupTemplate: (geo, data) => {
          if (!data) { return null; }
          const pluralizedLabel = data.numberOfThings === 1 ? label.slice(0, -1) : label
          return ['<div class="hoverinfo dark:bg-gray-800 dark:shadow-gray-850 dark:border-gray-850 dark:text-gray-200">',
            '<strong>', geo.properties.name, '</strong>',
            '<br><strong class="dark:text-indigo-400">', numberFormatter(data.numberOfThings), '</strong>', pluralizedLabel,
            '</div>'].join('');
        }
      },
      done: (datamap) => {
        datamap.svg.selectAll('.datamaps-subunit').on('click', (geography) => {
          navigateToQuery(
            this.props.history,
            this.props.query,
            {
              country: geography.id
            }
          )
        })
      }
    });
  }

  geolocationDbNotice() {
    if (this.props.site.selfhosted) {
      return (
        <span className="text-xs text-gray-500 absolute bottom-4 right-3">IP Geolocation by <a target="_blank" rel="noreferrer" href="https://db-ip.com" className="text-indigo-600">DB-IP</a></span>
      )
    }

    return null
  }

  renderBody() {
    if (this.state.countries) {
      return (
        <>
          <h3 className="font-bold dark:text-gray-100">Countries</h3>
          <div className="mx-auto mt-6" style={{width: '100%', maxWidth: '475px', height: '335px'}} id="map-container"></div>
          <MoreLink site={this.props.site} list={this.state.countries} endpoint="countries" />
          { this.geolocationDbNotice() }
        </>
      )
    }

    return null
  }

  render() {
    if (this.props.query.filters.region) {
      return <Cities site={this.props.site} query={this.props.query} />
    }

    if (this.props.query.filters.country) {
      return <Regions site={this.props.site} query={this.props.query} />
    }

    return (
      <div
        className="relative p-4 bg-white rounded shadow-xl stats-item flex flex-col dark:bg-gray-825 mt-6 w-full"
      >
        <LazyLoader onVisible={this.onVisible}>
          { this.state.loading && <div className="mx-auto my-32 loading"><div></div></div> }
          <FadeIn show={!this.state.loading}>
            { this.renderBody() }
          </FadeIn>
        </LazyLoader>
      </div>
    )
  }
}

export default withRouter(withThemeConsumer(Countries))
