import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Link, Route, Switch } from 'react-router-dom';
import { connect } from 'react-redux';

import Manage from '../../components/hirer/Manage';
import JobDetail from '../../components/hirer/JobDetail';
import PostJob from '../../components/hirer//PostJob';
import NotFound from '../../components/NotFound';
import UserInfoNav from '../../components/common/UserInfoNav';

const styles = theme => ({
    lightTooltip: {
        background: theme.palette.common.white,
        color: '#555',
        boxShadow: theme.shadows[1],
        fontSize: 15,
        maxWidth: 'inherit',
    },
});

class HirerCatagories extends Component {
    componentDidMount() {
        const { isConnected, history } = this.props;
        if (!isConnected) {
            history.push('/login');
        }
    }

    render() {
        const { match } = this.props;
        const listSubLink = [
            {
                title: 'Post a Job',
                path: `${match.url}`,
                exact: true,
                component: PostJob,
            },
            {
                title: 'Manage',
                path: `${match.url}/manage`,
                component: Manage,
            },
        ];

        return (
            <div id="main" className="container-wrp">
                <div className="container-wrp main-nav">
                    <div className="container">
                        <ul>
                            {listSubLink.map((route, key) => (
                                <Route key={key} path={route.path} exact={route.exact}>
                                    {({ match }) => (
                                        <li className={match ? 'actived' : null}>
                                            <Link to={route.path}>{route.title}</Link>
                                        </li>
                                    )}
                                </Route>
                            ))}
                        </ul>
                        <UserInfoNav />
                    </div>
                </div>
                <Switch>
                    <Route path={`${match.url}/manage/:jobId`} render={props => <JobDetail {...props} />} />
                    {listSubLink.length && listSubLink.map((route, key) => <Route key={key} {...route} />)}
                    <Route component={NotFound} />
                </Switch>
            </div>
        );
    }
}

HirerCatagories.propTypes = {
    history: PropTypes.object.isRequired,
    isConnected: PropTypes.bool.isRequired,
    match: PropTypes.object.isRequired,
    classes: PropTypes.object.isRequired,
};

const mapStateToProps = state => {
    return {
        isConnected: state.homeReducer.isConnected,
    };
};

const mapDispatchToProps = {};

export default withStyles(styles)(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(HirerCatagories)
);