import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import ReactMarkdown from 'react-markdown'
import Helmet from 'react-helmet'
import {ShareButtons, generateShareIcon} from 'react-share'
import {ButtonCloseText} from 'gComponents/utility/buttons/close/index.js'
import Icon from 'react-fa'

import Container from 'gComponents/utility/container/Container.js'
import {Input} from './input'
import {Output} from './output'

import {calculatorSpaceSelector} from './calculator-space-selector'

import {navigateFn} from 'gModules/navigation/actions'
import {fetchById} from 'gModules/calculators/actions'
import {deleteSimulations, runSimulations} from 'gModules/simulations/actions'
import {changeGuesstimate} from 'gModules/guesstimates/actions'

import * as Space from 'gEngine/space'
import * as Calculator from 'gEngine/calculator'

import {Guesstimator} from 'lib/guesstimator/index'

import '../style.css'

@connect(calculatorSpaceSelector, dispatch => bindActionCreators({fetchById, changeGuesstimate, deleteSimulations, runSimulations}, dispatch))
export class CalculatorShow extends Component {
  state = {
    attemptedFetch: false,
    resultComputing: false,
    showResult: false,
    hasSimulated: false,
    showHelp: false
  }

  componentWillMount() { this.fetchData() }
  componentWillReceiveProps(nextProps) {
    this.fetchData()
    if (!this.props.calculator && !!nextProps.calculator) {
      this.props.deleteSimulations([...nextProps.inputs.map(m => m.id), ...nextProps.outputs.map(m => m.id)])
    }
    if (this.state.resultComputing && this.allOutputsHaveStats()) {
      this.setState({resultComputing: false, showResult: true})
    }
  }

  fetchData() {
    if (!this.state.attemptedFetch) {
      this.props.fetchById(this.props.calculatorId)
      this.setState({attemptedFetch: true})
    }
  }

  onChange({id, guesstimate}, input) {
    const parsed = Guesstimator.parse({...guesstimate, input})
    const guesstimateType = parsed[1].samplerType().referenceName

    this.props.changeGuesstimate(
      id,
      {...guesstimate, ...{data: null, input, guesstimateType}},
      false  // saveOnServer
    )

    // We only want to simulate anything if all the inputs have simulatable content.
    if (!_.isEmpty(input) && _.isEmpty(parsed[0]) && this.allInputsHaveContent([id])) {
      if (!this.state.hasSimulated) {
        // The initial simulations should run on all unsimulated metrics.
        this.props.runSimulations({spaceId: this.props.calculator.space_id, onlyUnsimulated: true})
        this.setState({hasSimulated: true})
      } else {
        // Later simulations just run on the affected subslices.
        this.props.runSimulations({metricId: id})
      }
    }
  }

  onEnter() {
    if (!this.readyToCalculate()) { return }
    if (this.allOutputsHaveStats()) {
      if (!this.state.showResults) { this.setState({showResult: true}) }
    } else {
      if (!this.state.resultComputing) { this.setState({resultComputing: true}) }
    }
  }

  allInputsHaveContent(idsToExclude=[]) {
    const includedInputs = this.props.inputs.filter(i => !_.some(idsToExclude, id => i.id === id))
    const inputComponents = _.map(includedInputs, metric => this.refs[`input-${metric.id}`])
    return _.every(inputComponents, i => !!i && i.hasValidContent())
  }

  allOutputsHaveStats() {
    return this.props.outputs.map(o => !!o && _.has(o, 'simulation.stats')).reduce((x,y) => x && y, true)
  }

  readyToCalculate() {
    return this.allInputsHaveContent()
  }

  render() {
    if (!this.props.calculator) { return false }

    const {calculator: {content, title, space_id, share_image}, inputs, outputs, isPrivate} = this.props
    const spaceUrl = Space.url({id: space_id})
    const calculatorUrl = Calculator.fullUrl(this.props.calculator)

    let metaTags = [
      {name: 'Description', content},
      {property: 'og:description', content},
      {property: 'og:title', content: title},
      {property: 'og:site_name', content: 'Guesstimate'},
    ]
    if (!!share_image) {metaTags = metaTags.concat({property: 'og:image', content: share_image})}

    const {FacebookShareButton, TwitterShareButton} = ShareButtons
    const FacebookIcon = generateShareIcon('facebook')
    const TwitterIcon = generateShareIcon('twitter')
    let privacy_header = false
    if (isPrivate) {
      privacy_header = (<span className='privacy-icon'><Icon name='lock'/>Private</span>)
    }

    return (
      <Container>
        <Helmet title={title} meta={metaTags}/>
        <div className='row'>
          <div className='col-xs-0 col-md-2'/>
          <div className='col-xs-12 col-md-8'>
            {!this.state.showHelp &&
              <div className='calculator wide'>
                <div className='title-bar'>
                  <div className='row'>
                    <div className='col-xs-10'>
                      <h1>{title}</h1>
                      {privacy_header}
                    </div>
                    <div className='col-xs-2'>
                      <div className='button blue' onClick={() => {this.setState({showHelp: true})}}>Help </div>
                    </div>
                  </div>
                </div>
                <div className='description'>
                  <ReactMarkdown source={content} />
                </div>
                <div className='inputs'>
                  {_.map(inputs, (metric, i) => (
                    <Input
                      ref={`input-${metric.id}`}
                      key={i}
                      isFirst={i===0}
                      name={metric.name}
                      description={_.get(metric, 'guesstimate.description')}
                      errors={_.get(metric, 'simulation.sample.errors')}
                      onChange={this.onChange.bind(this, metric)}
                      onEnter={this.onEnter.bind(this)}
                    />
                  ))}
                </div>
                {this.state.showResult &&
                  <div>
                    <hr className='result-divider'/>
                    <div className='outputs'>
                      {_.map(outputs, (m, i) => <Output key={i} metric={m}/>)}
                    </div>
                  </div>
                }
                {!this.state.showResult &&
                  <div className='row'>
                    <div className='col-xs-12 col-md-7'/>
                    <div className='col-xs-12 col-md-5'>
                      <div
                        className={`ui button calculateButton${this.state.resultComputing ? ' loading' : this.readyToCalculate() ? '' : ' disabled'}`}
                        onClick={() => {this.allOutputsHaveStats() ? this.setState({showResult: true}) : this.setState({resultComputing: true})}}
                      >
                        Calculate
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
            {this.state.showHelp &&
              <div className='calculator wide help'>
                <div className='row'>
                  <div className='col-xs-9'>
                    <h1> Useful Information </h1>
                  </div>
                  <div className='col-xs-3'>
                    <ButtonCloseText onClick={() => {this.setState({showHelp: false})}}/>
                  </div>
                </div>
                <hr className='result-divider'/>

                <h2> Input Types </h2>

              <table className='ui celled table'>
                <thead>
                  <tr><th>Type</th><th>Example</th><th>Explanation</th></tr>
                </thead>
                <tbody>
                  <tr><td>Point</td><td><input className='editor' value='8'/></td><td>You believe this value is 8.</td></tr>
                  <tr><td>Range</td><td><input className='editor' value='6 to 12'/></td> <td>You believe this value is between 8 and 12.  More specifically, this indicates that you believe there's a 95% chance the value is above 6, and a 95% chance the value is below 12.</td></tr>
                </tbody>
              </table>

                <hr className='result-divider'/>
                <h2> Units </h2>

                <table className='ui celled table'>
                  <thead>
                    <tr><th>Symbol</th><th>Multiplier</th><th>Example</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>K</td><td>Thousand</td><td><input className='editor' value='3K to 8K'/></td></tr>
                    <tr><td>M</td><td>Million</td><td><input className='editor' value='3M to 8M'/></td></tr>
                    <tr><td>G</td><td>Billion</td><td><input className='editor' value='3G to 8G'/></td></tr>
                    <tr><td>T</td><td>Trillion</td><td><input className='editor' value='3T to 8T'/></td></tr>
                  </tbody>
                </table>
              </div>
            }

            <div className='information-section'>
              <div className='row'>
                <div className='col-xs-12 col-sm-6'>
                  <FacebookShareButton url={calculatorUrl} title={title}>
                    <FacebookIcon size={42}/>
                  </FacebookShareButton>
                  <TwitterShareButton url={calculatorUrl} title={title}>
                    <TwitterIcon size={42}/>
                  </TwitterShareButton>
                </div>
                <div className='col-sm-1'/>
                <div className='col-xs-12 col-sm-5 calculation-link-section'>
                  <a href={spaceUrl} onClick={navigateFn(spaceUrl)}>
                    <i className='ion-ios-redo'/> See calculations
                  </a>
                </div>
              </div>
            </div>

          </div>
          <div className='col-md-3' />
        </div>
      </Container>
    )
  }
}