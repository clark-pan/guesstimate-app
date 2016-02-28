import React, {Component, PropTypes} from 'react'
import Plans from './plans.js'
import { connect } from 'react-redux';

function mapStateToProps(state) {
  return {
    me: state.me
  }
}

@connect(mapStateToProps)
export default class PlanIndexContainer extends Component{
  displayName: 'PlanIndexContainer'

  render () {
    const {me} = this.props
    const portalUrl = _.get(me, 'profile.account._links.payment_portal.href')
    const userPlanId = _.get(me, 'profile.plan.id')
    const props = {portalUrl, userPlanId}

    return (
      <PlanIndex {...props}/>
    )
  }
}

class PortalMessage extends Component{
  render() {
    const {portalUrl} = this.props
    if (!!portalUrl) {
      return (
        <div className='portal-message-container'>
          <div className='portal-message'>
            <h2>{'Go to the portal to change plans & payment'}</h2>
            <a className='ui button large primary'
              href={portalUrl}
              target='_blank'
            >
              Go to Portal
            </a>
          </div>
        </div>
      )
    } else {
      return false
    }
  }
}

export class PlanIndex extends Component{
  displayName: 'PlanIndex'
  render () {
    const {planId, portalUrl} = this.props
    const showButtons = (planId === 'personal_free') && !!portalUrl

    return (
      <div className='PlanIndex'>
        <div className='header'>
          <h1> Plans & Pricing </h1>
        </div>

        <PortalMessage portalUrl={'google.com'}/>

        <div className='cards'>
          <Plans showButtons={false}/>
        </div>
      </div>
    )
  }
}
