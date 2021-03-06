import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Grid from '@material-ui/core/Grid';
import Select from 'react-select';
import ButtonBase from '@material-ui/core/ButtonBase';
import CircularProgress from '@material-ui/core/CircularProgress';
import SearchInput, { createFilter } from 'react-search-input';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

import DisputesRender from './DisputesRender';
import SwitchIOS from '../common/switchIOS';

import Utils from '../../_utils/utils';
import settingsApi from '../../_services/settingsApi';
import abiConfig from '../../_services/abiConfig';

import { saveVotingParams } from '../freelancer/actions';
import { saveDisputes } from '../voter/actions';

let disputes = [];
let disputesSource = [];
const options = ['Latest', 'Oldest'];
const KEYS_TO_FILTERS = ['jobDispute.title'];

class DisputeBrowser extends Component {
    constructor(props) {
        super(props);
        this.state = {
            anchorEl: null,
            selectedIndex: 0,
            searchTerm: '',
            isLoading: false,
            stt: { err: false, text: null },
        };
        this.timer = null;
        this.mounted = false;
    }

    componentDidMount() {
        const { isConnected } = this.props;
        const { isLoading } = this.state;

        if (isConnected) {
            if (!isLoading) {
                this.mounted = true;
                this.getDisputes();
            }
        }
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    getDisputes = () => {
        const { web3 } = this.props;
        this.setState({ isLoading: true });
        disputes = [];

        // time out 20s
        setTimeout(() => {
            if (disputes.length <= 0) {
                this.setState({ stt: { err: true, text: 'Have no any dispute to show!' }, isLoading: false });
                return;
            }
        }, 20000);

        abiConfig.getAllAvailablePoll(web3, this.disputeCreatedInit);
    };

    disputeCreatedInit = async disputeDataResult => {
        //console.log('disputeCreatedInit success: ', disputeData);
        const disputeData = disputeDataResult.data;
        const URl = abiConfig.getIpfsLink() + disputeData.jobHash;
        let dispute = {
            ...disputeData,
            jobDispute: {},
        };
        fetch(URl)
            .then(res => res.json())
            .then(
                result => {
                    dispute.jobDispute.title = result.title;
                    dispute.jobDispute.skills = result.skills;
                    dispute.jobDispute.category = result.category;
                    dispute.jobDispute.description = result.description;
                    dispute.jobDispute.currency = result.currency;
                    dispute.jobDispute.budget = result.budget;
                    dispute.jobDispute.estimatedTime = result.estimatedTime;
                    dispute.jobDispute.expiredTime = result.expiredTime;
                    dispute.jobDispute.created = result.created;
                    this.disputeListInit(dispute);
                },
                error => {
                    console.log(error);
                    dispute.err = 'Can not fetch data from server';
                }
            );
    };

    disputeListInit = jobDispute => {
        //console.log('disputeListInit success: ', jobDispute);
        const { selectedIndex } = this.state;
        const { saveDisputes } = this.props;
        disputes.push(jobDispute);
        const uqDisputes = Utils.removeDuplicates(disputes, 'pollID'); // fix duplicate data
        this.handleMenuItemSort(null, selectedIndex, disputes);
        if (this.mounted) {
            saveDisputes(uqDisputes);
            disputesSource = uqDisputes;
            this.setState({ isLoading: false });
        }
    };

    disputeFilterByCategory(filterData) {
        let disputesFilter = [];
        const { saveDisputes } = this.props;
        if (filterData) {
            if (filterData.length > 0) {
                for (let category of filterData) {
                    const disputesFilterSelected = disputes.filter(dispute => dispute.jobDispute.category.value === category.value);
                    disputesFilter = [...disputesFilter, ...disputesFilterSelected];
                    saveDisputes(disputesFilter);
                }
            } else {
                saveDisputes(disputes);
            }
        }
    }

    stageListSwitch = switched => {
        const { disputes, saveDisputes } = this.props;
        const { selectedIndex } = this.state;
        if (!switched) {
            const disputeFiltered = disputes.filter(dispute => dispute.evidenceEndDate <= Date.now());
            saveDisputes(disputeFiltered);
            this.handleMenuItemSort(null, selectedIndex, disputes);
        } else {
            saveDisputes(disputesSource);
            this.handleMenuItemSort(null, selectedIndex, disputes);
        }
    };

    searchUpdated(term) {
        this.setState({ searchTerm: term });
    }

    handleClickListItemSort = event => {
        this.setState({ anchorEl: event.currentTarget });
    };

    handleMenuItemSort = (event, index, Disputes) => {
        if (this.mounted) {
            this.setState({ selectedIndex: index, anchorEl: null });
        }
        switch (index) {
            case 0:
                //Latest
                Disputes.sort((a, b) => {
                    return b.created - a.created;
                });
                break;
            case 1:
                // Oldest
                Disputes.sort((a, b) => {
                    return a.created - b.created;
                });
                break;
            default:
                // Latest
                Disputes.sort((a, b) => {
                    return b.created - a.created;
                });
        }
    };

    handleClose = () => {
        this.setState({ anchorEl: null });
    };

    handleChangeCategory = selectedOption => {
        this.setState({ selectedCategory: selectedOption });
        this.disputeFilterByCategory(selectedOption);
    };

    render() {
        const { selectedCategory, anchorEl, isLoading, stt } = this.state;
        const { disputes } = this.props;
        const availableDisputes = disputes.filter(dispute => dispute.commitEndDate > Date.now());
        const filteredDisputes = availableDisputes.filter(createFilter(this.state.searchTerm, KEYS_TO_FILTERS));
        const categories = settingsApi.getCategories();
        return (
            <div id="freelancer" className="container-wrp">
                <div className="container-wrp full-top-wrp">
                    <div className="container wrapper">
                        <Grid container className="main-intro">
                            <h1>Find a dispute and voting to get reward</h1>
                            <span className="description">Use filter tool to find all dispute that fit to you.</span>
                        </Grid>
                    </div>
                </div>
                <div className="container-wrp main-ct">
                    <div className="container wrapper">
                        <Grid className="top-actions">
                            <SwitchIOS className="stage-switch" text="Include Evidence Stage" action={this.stageListSwitch} />
                            <Grid className="action reload-btn">
                                <ButtonBase className="btn btn-normal btn-green" onClick={this.getDisputes}>
                                    <i className="fas fa-sync-alt" />
                                    Refresh
                                </ButtonBase>
                            </Grid>
                        </Grid>
                        <Grid container className="single-body">
                            <Grid container className="filter">
                                <Grid item xs={5}>
                                    <SearchInput className="search-input" placeholder="Search..." onChange={e => this.searchUpdated(e)} />
                                </Grid>
                                <Grid item xs={5}>
                                    <Select
                                        value={selectedCategory}
                                        onChange={this.handleChangeCategory}
                                        options={categories}
                                        isMulti
                                        placeholder="Select category..."
                                    />
                                </Grid>
                                <Grid item xs={2} className="sort">
                                    <List component="nav">
                                        <ListItem
                                            className="select-item"
                                            button
                                            aria-haspopup="true"
                                            aria-controls="lock-menu"
                                            aria-label="Sort by"
                                            onClick={this.handleClickListItemSort}
                                        >
                                            <ListItemText
                                                className="select-item-text"
                                                primary="Sort by"
                                                secondary={options[this.state.selectedIndex]}
                                            />
                                            <i className="fas fa-angle-down icon" />
                                        </ListItem>
                                    </List>
                                    <Menu id="lock-menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={this.handleClose}>
                                        {options.map((option, index) => (
                                            <MenuItem
                                                key={option}
                                                selected={index === this.state.selectedIndex}
                                                onClick={event => this.handleMenuItemSort(event, index, disputes)}
                                            >
                                                {option}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </Grid>
                            </Grid>
                            {!isLoading ? (
                                !stt.err ? (
                                    <DisputesRender disputes={filteredDisputes} />
                                ) : (
                                    <div className="no-data">{stt.text}</div>
                                )
                            ) : (
                                <div className="loading">
                                    <CircularProgress size={50} color="secondary" />
                                    <span>Loading...</span>
                                </div>
                            )}
                        </Grid>
                    </div>
                </div>
            </div>
        );
    }
}

DisputeBrowser.propTypes = {
    web3: PropTypes.object.isRequired,
    isConnected: PropTypes.bool.isRequired,
    saveDisputes: PropTypes.func.isRequired,
    disputes: PropTypes.any.isRequired,
};
const mapStateToProps = state => {
    return {
        web3: state.homeReducer.web3,
        isConnected: state.homeReducer.isConnected,
        disputes: state.voterReducer.disputes,
        votingParams: state.freelancerReducer.votingParams,
    };
};

const mapDispatchToProps = { saveDisputes, saveVotingParams };

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(DisputeBrowser);
