import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import ReactDOM from 'react-dom'
import $ from 'jquery'

import {MetricModal} from 'gComponents/metrics/modal/index'
import DistributionEditor from 'gComponents/distributions/editor/index'
import MetricToolTip from './tooltip'
import ToolTip from 'gComponents/utility/tooltip/index'
import {MetricCardViewSection} from './MetricCardViewSection/index'
import SensitivitySection from './SensitivitySection/SensitivitySection'

import {hasMetricUpdated} from './updated'
import {removeMetrics, changeMetric} from 'gModules/metrics/actions'
import {changeGuesstimate} from 'gModules/guesstimates/actions'
import {analyzeMetricId, endAnalysis} from 'gModules/canvas_state/actions'

import * as canvasStateProps from 'gModules/canvas_state/prop_type'
import {PTLocation} from 'lib/locationUtils'
import {getVariableNameFromName, shouldTransformName} from 'lib/nameToVariableName'

import {INTERMEDIATE, OUTPUT, INPUT, NOEDGE, relationshipType} from 'gEngine/graph'
import {makeURLsMarkdown} from 'gEngine/utils'

import './style.css'

import Icon from 'react-fa'

const relationshipClasses = {}
relationshipClasses[INTERMEDIATE] = 'intermediate'
relationshipClasses[OUTPUT] = 'output'
relationshipClasses[INPUT] = 'input'
relationshipClasses[NOEDGE] = 'noedge'

class ScatterTip extends Component {
  render() {
    return (
      <ToolTip size='LARGE'>
        <SensitivitySection yMetric={this.props.yMetric} xMetric={this.props.xMetric} size={'LARGE'}/>
      </ToolTip>
    )
  }
}

const PT = PropTypes

@connect(null, dispatch => bindActionCreators({
  changeMetric,
  changeGuesstimate,
  removeMetrics,
  analyzeMetricId,
  endAnalysis
}, dispatch))
export default class MetricCard extends Component {
  displayName: 'MetricCard'

  static propTypes = {
    canvasState: canvasStateProps.canvasState,
    changeMetric: PT.func.isRequired,
    changeGuesstimate: PT.func.isRequired,
    removeMetrics: PT.func.isRequired,
    gridKeyPress: PT.func.isRequired,
    inSelectedCell: PT.bool.isRequired,
    location: PTLocation,
    metric: PT.object.isRequired
  }

  state = {
    modalIsOpen: false,
    editing: false,
    sidebarIsOpen: false,
  }

  shouldComponentUpdate(nextProps, nextState) {
    return hasMetricUpdated(this.props, nextProps) ||
      (this.state.modalIsOpen !== nextState.modalIsOpen) ||
      (this.state.sidebarIsOpen !== nextState.sidebarIsOpen)
  }

  _beginAnalysis(){
    this.props.analyzeMetricId(this._id())
  }

  _endAnalysis(){
    this.props.endAnalysis()
  }

  onEdit() {
    if (!this.state.editing) { this.setState({editing: true}) }
  }

  focusFromDirection(dir) {
    if (dir === 'DOWN' || dir === 'RIGHT') { this._focusForm() }
    else { this.refs.MetricCardViewSection.focusName() }
  }

  componentWillUpdate(nextProps) {
    window.recorder.recordRenderStartEvent(this)
    if (this.state.editing && !nextProps.inSelectedCell) { this.setState({editing: false}) }
    if (this.props.inSelectedCell && !nextProps.inSelectedCell) { this._closeSidebar() }
    if (this.props.hovered && !nextProps.hovered){ this._closeSidebar() }
  }
  componentWillUnmount() { window.recorder.recordUnmountEvent(this) }

  componentDidUpdate(prevProps) {
    window.recorder.recordRenderStopEvent(this)

    const hasContent = this.refs.MetricCardViewSection.hasContent()
    const {inSelectedCell, selectedFrom} = this.props
    if (!inSelectedCell && this._isEmpty() && !hasContent && !this.state.modalIsOpen){
      this.handleRemoveMetric()
    }
    if (!prevProps.inSelectedCell && inSelectedCell && !!selectedFrom) {
      this.focusFromDirection(selectedFrom)
    }
  }

  componentDidMount() {
    window.recorder.recordMountEvent(this)
    if (this.props.inSelectedCell && this._isEmpty()) {
      this.focusFromDirection(this.props.selectedFrom)
    }
  }

  openModal() {
    this.setState({modalIsOpen: true, sidebarIsOpen: false});
  }

  closeModal() {
    this.setState({modalIsOpen: false});
  }

  _toggleSidebar() {
    this.setState({sidebarIsOpen: (!this.state.sidebarIsOpen), modalIsOpen: false});
  }

  _closeSidebar() {
    if (this.state.sidebarIsOpen) {
      this.setState({sidebarIsOpen: false})
    }
  }

  _handleKeyDown(e) {
    if (e.target === ReactDOM.findDOMNode(this)) {
      if (e.keyCode == '13' && this.props.inSelectedCell) {
        e.preventDefault()
        e.stopPropagation()
        this.openModal()
      }
    }
  }

  _handleKeyPress(e) {
    if (e.target === ReactDOM.findDOMNode(this)) {
      this.props.gridKeyPress(e)
    }
    e.stopPropagation()
  }

  _isEmpty(){
    return !(this._hasGuesstimate() || this._hasName() || this._hasDescription())
  }

  _hasName(){
    return !!this.props.metric.name
  }

  _hasDescription(){
    return !!_.get(this.props.metric, 'guesstimate.description')
  }

  _hasGuesstimate(){
    const has = (item) => !!_.get(this.props.metric, `guesstimate.${item}`)
    return (has('input') || has('data'))
  }

  _isTitle(){
    return (this._hasName() && !this._hasGuesstimate())
  }

  onChangeMetricName(name) {
    if (name === _.get(this, 'props.metric.name')) { return }
    let metric = {id: this._id(), name}
    const shouldUpdateReadableId = shouldTransformName(name)
    if (shouldUpdateReadableId) {
      const newReadableIdRaw = getVariableNameFromName(name, this.props.existingReadableIds, 3, 3, 5).toUpperCase()
      metric.readableId = newReadableIdRaw.replace(/\_/g, '')
    }
    this.props.changeMetric(metric)
  }

  onChangeGuesstimateDescription(rawDescription) {
    const description = makeURLsMarkdown(rawDescription)
    this.props.changeGuesstimate(this._id(), {...this.props.metric.guesstimate, description})
  }

  handleRemoveMetric () {
    this.props.removeMetrics([this._id()])
  }

  _id(){
    return this.props.metric.id
  }

  focus() {
    $(this.refs.dom).focus();
  }

  _focusForm() {
    const editorRef = _.get(this.refs, 'DistributionEditor.refs.wrappedInstance')
    editorRef && editorRef.focus()
  }

  _handleMouseDown(e) {
    if (this._isFunctionInputSelectable(e) && !e.shiftKey) {
      $(window).trigger('functionMetricClicked', this.props.metric)
      // TODO(matthew): Why don't these stop the triggering of the flow grid cell?
      e.preventDefault()
      e.stopPropagation()
    }
  }

  _isSelectable(e) {
    const selectableEl = (e.target.parentElement.getAttribute('data-select') !== 'false')
    const notYetSelected = !this.props.inSelectedCell
    return (selectableEl && notYetSelected)
  }

  _isFunctionInputSelectable(e) {
    return (this._isSelectable(e) && (this.props.canvasState.metricClickMode === 'FUNCTION_INPUT_SELECT'))
  }

  _className() {
    const {inSelectedCell, metric, hovered} = this.props
    const {canvasState: {metricCardView}} = this.props
    const relationshipClass = relationshipClasses[relationshipType(metric.edges)]

    const titleView = !hovered && !inSelectedCell && this._isTitle()
    let className = inSelectedCell ? 'metricCard grid-item-focus' : 'metricCard'
    className += ` ${metricCardView}`
    className += titleView ? ' titleView' : ''
    className += ' ' + relationshipClass
    return className
  }

  _shouldShowSimulation(metric) {
    const stats = _.get(metric, 'simulation.stats')
    return (stats && _.isFinite(stats.stdev) && (stats.length > 5))
  }

  _shouldShowSensitivitySection() {
    const {metric, analyzedMetric} = this.props
    return !!(analyzedMetric && !this._isAnalyzedMetric() && this._shouldShowSimulation(metric) && this._shouldShowSimulation(analyzedMetric))
  }

  _canBeAnalyzed() {
    const {metric} = this.props
    return this._shouldShowSimulation(metric)
  }

  _isAnalyzedMetric() {
    const {metric, analyzedMetric} = this.props
    return !!analyzedMetric && metric.id === analyzedMetric.id
  }

  // If sidebar is expanded, we want to close it if anything else is clicked
  onMouseDown(e){
    const isSidebarElement = (_.get(e, 'target.dataset.controlSidebar') === "true")
    if (this.state.sidebarIsOpen && !isSidebarElement){
      this._toggleSidebar()
    }
  }

  render() {
    const {
      inSelectedCell,
      metric,
      organizationId,
      canUseOrganizationFacts,
      canvasState,
      hovered,
      connectDragSource,
      analyzedMetric,
      forceFlowGridUpdate,
    } = this.props
    const {guesstimate} = metric
    const shouldShowSensitivitySection = this._shouldShowSensitivitySection()
    const isAnalyzedMetric = this._isAnalyzedMetric()

    return (
      <div className='metricCard--Container'
        ref='dom'
        onKeyPress={this._handleKeyPress.bind(this)}
        onKeyDown={this._handleKeyDown.bind(this)}
        tabIndex='0'
      >
        <div
          className={this._className()}
          onMouseDown={this.onMouseDown.bind(this)}
        >
          {this.state.modalIsOpen &&
            <MetricModal
              metric={metric}
              closeModal={this.closeModal.bind(this)}
              onChangeGuesstimateDescription={this.onChangeGuesstimateDescription.bind(this)}
            />
          }

          <MetricCardViewSection
            canvasState={canvasState}
            metric={metric}
            inSelectedCell={inSelectedCell}
            onChangeName={this.onChangeMetricName.bind(this)}
            onToggleSidebar={this._toggleSidebar.bind(this)}
            jumpSection={this._focusForm.bind(this)}
            onMouseDown={this._handleMouseDown.bind(this)}
            ref='MetricCardViewSection'
            isTitle={this._isTitle()}
            connectDragSource={connectDragSource}
            analyzedMetric={analyzedMetric}
            showSensitivitySection={shouldShowSensitivitySection}
            heightHasChanged={forceFlowGridUpdate}
            hovered={hovered}
            editing={this.state.editing}
            onEscape={this.focus.bind(this)}
            onReturn={this.props.onReturn}
            onTab={this.props.onTab}
          />

          {inSelectedCell &&
            <div className='section editing'>
              <DistributionEditor
                guesstimate={metric.guesstimate}
                inputMetrics={metric.edges.inputMetrics}
                metricId={metric.id}
                organizationId={organizationId}
                canUseOrganizationFacts={canUseOrganizationFacts}
                metricFocus={this.focus.bind(this)}
                jumpSection={() => {this.refs.MetricCardViewSection.focusName()}}
                onOpen={this.openModal.bind(this)}
                ref='DistributionEditor'
                size='small'
                onReturn={this.props.onReturn}
                onTab={this.props.onTab}
                onEdit={this.onEdit.bind(this)}
              />
            </div>
          }
        </div>
        {hovered && !inSelectedCell && !shouldShowSensitivitySection && <MetricToolTip guesstimate={guesstimate}/>}
        {hovered && !inSelectedCell && shouldShowSensitivitySection &&
          <ScatterTip yMetric={analyzedMetric} xMetric={metric}/>
        }
        {inSelectedCell && this.state.sidebarIsOpen &&
          <MetricSidebar
            onOpenModal={this.openModal.bind(this)}
            onRemoveMetric={this.handleRemoveMetric.bind(this)}
            showAnalysis={this._canBeAnalyzed()}
            onBeginAnalysis={this._beginAnalysis.bind(this)}
            onEndAnalysis={this._endAnalysis.bind(this)}
            isAnalyzedMetric={isAnalyzedMetric}
          />
        }
      </div>
    );
  }
}

const MetricSidebar = ({onOpenModal, onBeginAnalysis, onEndAnalysis, onRemoveMetric, showAnalysis, isAnalyzedMetric}) => (
  <div className='MetricSidebar'>
    <MetricSidebarItem
      icon={<Icon name='expand'/>}
      name={'Expand'}
      onClick={onOpenModal}
    />
    {showAnalysis && !isAnalyzedMetric &&
      <MetricSidebarItem
        icon={<Icon name='bar-chart'/>}
        name={'Sensitivity'}
        onClick={onBeginAnalysis}
      />
    }
    {showAnalysis && isAnalyzedMetric &&
      <MetricSidebarItem
        className='analyzing'
        icon={<Icon name='close'/>}
        name={'Sensitivity'}
        onClick={onEndAnalysis}
      />
    }
    <MetricSidebarItem
      icon={<Icon name='trash'/>}
      name={'Delete'}
      onClick={onRemoveMetric}
    />
  </div>
)

const MetricSidebarItem = ({className, onClick, icon, name}) => (
  <a
    href='#'
    className={`MetricSidebarItem ${className && className}`}
    onMouseDown={onClick}
  >
    <span className='MetricSidebarItem--icon'>
      {icon}
    </span>
    <span className='MetricSidebarItem--name'>
      {name}
    </span>
  </a>
)
