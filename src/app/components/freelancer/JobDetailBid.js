import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import Grid from '@material-ui/core/Grid';
import ButtonBase from '@material-ui/core/ButtonBase';
import CircularProgress from '@material-ui/core/CircularProgress';
import Fade from '@material-ui/core/Fade';

import Utils from '../../_utils/utils';
import abiConfig from '../../_services/abiConfig';
import api from '../../_services/settingsApi';

import Countdown from '../common/countdown';
import Popper from '../common/Popper';
import DialogPopup from '../common/dialog';
import CreateDispute from '../freelancer/CreateDispute';
import { setActionBtnDisabled } from '../common/actions';
import { saveVotingParams } from './actions';

let myAddress;

const skillShow = job => {
    const jobSkills = job.skills;
    return (
        <div className="skill">
            <span className="bold">Skill required</span>
            {jobSkills.map((skill, i) => {
                return (
                    <span className="tag" key={i}>
                        {skill.label}
                    </span>
                );
            })}
        </div>
    );
};

class JobDetailBid extends Component {
    constructor(props) {
        super(props);
        this.state = {
            stt: { err: false, text: null },
            isOwner: false,
            checkedBid: false,
            time: 0,
            award: 0,
            open: false,
            actStt: { err: false, text: null, link: '' },
            dialogLoading: false,
            dialogData: {
                title: null,
                actionText: null,
                actions: null,
            },
            claim: false,
            checkedDispute: false,
            disputeStt: {
                clientResponseDuration: 0,
                started: false,
            },
            clientRespondedDispute: { responded: false, commitDuration: 0 },
            anchorEl: null,
            evidenceShow: false,
        };
        this.setActionBtnDisabled = this.props.setActionBtnDisabled;
    }

    componentDidMount() {
        const { isConnected, web3, saveVotingParams } = this.props;
        const { isLoading } = this.state;
        abiConfig.getVotingParams(web3, saveVotingParams);
        myAddress = web3.eth.defaultAccount;
        if (isConnected) {
            if (!isLoading) {
                this.mounted = true;
                this.jobDataInit(false);
            }
        }
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    getMyBid() {
        const { jobData } = this.state;
        if (jobData.bid.length > 0) {
            for (let freelancer of jobData.bid) {
                if (freelancer.address === myAddress) {
                    return (
                        <Grid item className="job-detail-col">
                            <div className="name">Your Bid ({jobData.currency.label})</div>
                            <div className="ct">{Utils.currencyFormat(freelancer.award)}</div>
                        </Grid>
                    );
                }
            }
        } else {
            return (
                <Grid item className="job-detail-col">
                    <div className="name">Your Bid ({jobData.currency.label})</div>
                    <div className="ct">NaN</div>
                </Grid>
            );
        }
    }

    getReasonPaymentRejected = async paymentRejectReason => {
        if (this.mounted) {
            this.setState({ paymentRejectReason });
        }
    };

    setDisputeStt = async event => {
        const { votingParams } = this.props;
        const clientResponseDuration = Math.floor(new Date(event.created + Number(votingParams.evidenceDuration)) * 1000);
        if (clientResponseDuration > Date.now()) {
            if (this.mounted) {
                this.setState({ disputeStt: { started: event.started, clientResponseDuration } });
            }
        } else {
            if (this.mounted) {
                this.setState({ disputeStt: { started: event.started, clientResponseDuration: 0 } });
            }
        }
    };

    setRespondedisputeStt = async event => {
        const { votingParams } = this.props;
        const commitDuration = Math.floor(new Date(event.created + Number(votingParams.commitDuration)) * 1000);
        if (commitDuration > Date.now()) {
            const URl = abiConfig.getIpfsLink() + event.proofHash;
            fetch(URl)
                .then(res => res.json())
                .then(
                    result => {
                        const clientProof = {
                            text: result.proof,
                            imgs: result.imgs,
                        };
                        if (this.mounted) {
                            this.setState({
                                clientRespondedDispute: {
                                    responded: event.responded,
                                    commitDuration,
                                    clientProof,
                                },
                                disputeStt: {
                                    clientResponseDuration: 0,
                                    started: true,
                                },
                            });
                        }
                    },
                    error => {
                        console.log(error);
                        if (this.mounted) {
                            this.setState({
                                clientRespondedDispute: {
                                    responded: event.responded,
                                    commitDuration,
                                    clientProof: { imgs: [], text: 'Client’s evidence not found!' },
                                },
                                disputeStt: {
                                    clientResponseDuration: 0,
                                    started: true,
                                },
                            });
                        }
                    }
                );
        } else {
            if (this.mounted) {
                this.setState({ clientRespondedDispute: { responded: event.responded, commitDuration: 0 } });
            }
        }
    };

    finalizeDispute = async () => {
        const { web3 } = this.props;
        const { jobHash } = this.state;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBDispute');
        const [err, tx] = await Utils.callMethod(ctInstance.instance.finalizePoll)(jobHash, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                finalizeDisputeDone: false,
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not finalize dispute! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            finalizeDisputeDone: true,
            dialogLoading: false,
            actStt: {
                err: false,
                text: 'Your request has been sent! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    actions = () => {
        const { web3 } = this.props;
        const { jobData, isOwner, checkedBid, bidDone, cancelBidDone, startJobDone, completeJobDone, claimPaymentDone, claim } = this.state;
        const mybid = jobData.bid.filter(bid => bid.address === web3.eth.defaultAccount);
        const mybidAccepted = jobData.bid.filter(bid => bid.accepted && bid.address === web3.eth.defaultAccount);
        if (!isOwner) {
            if (!jobData.status.paymentAccepted || !jobData.status.claimed) {
                if (jobData.status.bidding) {
                    if (mybid.length > 0) {
                        if (mybid[0].canceled) {
                            return (
                                <span className="note">
                                    <span className="bold">Sorry, you have canceled this job</span>, you can not bid again
                                </span>
                            );
                        }
                        return (
                            <span className="note">
                                <i className="fas fa-check-circle green" /> <span className="bold">You have bid this job</span>, please waiting
                                acceptance from job owner.
                                <ButtonBase className="btn btn-normal btn-red btn-bid" onClick={this.confirmCancelBid} disabled={cancelBidDone}>
                                    Cancel Bid
                                </ButtonBase>
                            </span>
                        );
                    } else {
                        return (
                            <ButtonBase
                                className="btn btn-normal btn-green btn-back btn-bid"
                                onClick={() => this.bidSwitched(true)}
                                aria-label="Collapse"
                                checked={checkedBid}
                                disabled={bidDone}
                            >
                                Bid On This Job
                            </ButtonBase>
                        );
                    }
                } else if (!jobData.status.waiting && !jobData.status.reject && !jobData.status.paymentAccepted && !jobData.status.disputing) {
                    if (mybidAccepted.length > 0) {
                        return (
                            <span>
                                {!jobData.status.started && !jobData.status.completed && !jobData.status.claimed ? (
                                    <ButtonBase
                                        className="btn btn-normal btn-green btn-back btn-bid"
                                        onClick={this.confirmStartJob}
                                        disabled={startJobDone}
                                    >
                                        Start Job
                                    </ButtonBase>
                                ) : !jobData.status.completed && !jobData.status.claimed && !jobData.status.paymentAccepted ? (
                                    <ButtonBase
                                        className="btn btn-normal btn-blue btn-back btn-bid"
                                        onClick={this.confirmCompleteJob}
                                        disabled={completeJobDone}
                                    >
                                        Complete
                                    </ButtonBase>
                                ) : (
                                    !jobData.status.claimed &&
                                    (claim && (
                                        <ButtonBase
                                            className="btn btn-normal btn-orange btn-back btn-bid"
                                            onClick={this.confirmClaimPayment}
                                            disabled={claimPaymentDone}
                                        >
                                            Claim Payment
                                        </ButtonBase>
                                    ))
                                )}
                            </span>
                        );
                    }
                }
            }
        } else {
            return (
                <span className="note">
                    <ButtonBase onClick={this.viewMyJobs} className="btn btn-normal btn-blue">
                        View all your jobs
                    </ButtonBase>
                </span>
            );
        }
        return null;
    };

    evidence = () => {
        const { clientRespondedDispute } = this.state;
        return (
            <div className="evidence-show">
                <p className="bold">Client’s evidence</p>
                <p>{clientRespondedDispute.clientProof.text}</p>
            </div>
        );
    };

    disputeActions = () => {
        const { disputeCreated, web3 } = this.props;
        const { disputeStt, anchorEl, jobData, clientRespondedDispute, evidenceShow, finalizeDisputeDone, paymentRejectReason } = this.state;
        const isPopperOpen = Boolean(anchorEl);
        console.log(paymentRejectReason);
        const mybidAccepted = jobData.bid.filter(bid => bid.accepted && bid.address === web3.eth.defaultAccount);
        if (!clientRespondedDispute.responded) {
            if (jobData.status.reject && mybidAccepted.length > 0) {
                return (
                    <div className="dispute-actions">
                        <span className="note">
                            <i className="fas fa-ban red" /> Sorry, job owner has <span className="bold">rejected payment</span> for you.{' '}
                            <Popper
                                placement="top"
                                anchorEl={anchorEl}
                                id="mouse-over-popover"
                                onClose={this.handlePopoverClose}
                                disableRestoreFocus
                                open={isPopperOpen}
                                content={paymentRejectReason && api.getReason(Number(paymentRejectReason.reason)).text}
                            />
                            <ButtonBase
                                className="btn btn-small btn-gray bold blue"
                                aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                                aria-haspopup="true"
                                onMouseEnter={this.handlePopoverOpen}
                                onMouseLeave={this.handlePopoverClose}
                            >
                                <i className="fas fa-info-circle" /> reason
                            </ButtonBase>
                            <ButtonBase
                                className="btn btn-normal btn-orange btn-bid float-right"
                                onClick={this.handleCreateDisputeClose}
                                disabled={disputeCreated}
                            >
                                Create Dispute
                            </ButtonBase>
                        </span>
                    </div>
                );
            } else if (jobData.status.disputing) {
                return (
                    <div className="dispute-actions">
                        {disputeStt.clientResponseDuration > 0 ? (
                            <span className="note">
                                <span className="bold">You have created dispute for this job</span>, please waiting for response from your client.
                            </span>
                        ) : (
                            <span className="note">
                                Your client did not responded to your dispute.{' '}
                                <ButtonBase
                                    onClick={this.confirmFinalizeDispute}
                                    disabled={finalizeDisputeDone}
                                    className="btn btn-normal btn-green btn-bid float-right"
                                >
                                    Finalized Dispute
                                </ButtonBase>
                            </span>
                        )}
                    </div>
                );
            }
        } else {
            if (clientRespondedDispute.commitDuration > 0) {
                return (
                    <div className="dispute-actions">
                        <span className="note">
                            <Popper
                                placement="top"
                                anchorEl={anchorEl}
                                id="mouse-over-popover"
                                onClose={this.handlePopoverClose}
                                disableRestoreFocus
                                open={isPopperOpen}
                                content="Your client have participated into your dipute......."
                            />
                            <span className="bold">Your client have participated into your dispute. Please waiting for result from Voters</span>
                            <i
                                className="fas fa-info-circle icon-popper-note"
                                aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                                aria-haspopup="true"
                                onMouseEnter={this.handlePopoverOpen}
                                onMouseLeave={this.handlePopoverClose}
                            />
                            <ButtonBase onClick={this.handleEvidenceShow} className="btn btn-normal btn-dark-green btn-bid float-right">
                                {evidenceShow ? (
                                    <i className="fas fa-angle-up icon-popper-note" />
                                ) : (
                                    <i className="fas fa-angle-down icon-popper-note" />
                                )}
                                Freelancer&#39;s Evidences
                            </ButtonBase>
                        </span>
                        {evidenceShow && this.evidence()}
                    </div>
                );
            } else {
                return (
                    <div className="dispute-actions">
                        <span className="note">
                            <Popper
                                placement="top"
                                anchorEl={anchorEl}
                                id="mouse-over-popover"
                                onClose={this.handlePopoverClose}
                                disableRestoreFocus
                                open={isPopperOpen}
                                content="Text Description..."
                            />
                            <span className="bold">waiting for result from voters (Commit Duration)</span>
                            <i
                                className="fas fa-info-circle icon-popper-note"
                                aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                                aria-haspopup="true"
                                onMouseEnter={this.handlePopoverOpen}
                                onMouseLeave={this.handlePopoverClose}
                            />
                        </span>
                    </div>
                );
            }
        }
    };

    disputeSttInit = async () => {
        const { match, web3 } = this.props;
        const jobHash = match.params.jobId;
        abiConfig.getEventsPollStarted(web3, jobHash, this.setDisputeStt);

        // check client dispute response status
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBDispute');
        const [error, re] = await Utils.callMethod(ctInstance.instance.isAgaintsPoll)(jobHash, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        if (!error) {
            if (re) {
                abiConfig.getEventsPollAgainsted(web3, jobHash, this.setRespondedisputeStt);
            } else {
                if (this.mounted) {
                    this.setState({ clientRespondedDispute: { responded: false, commitDuration: 0 } });
                }
            }
        }
    };

    jobDataInit = async refresh => {
        const { match, web3, jobs } = this.props;
        const jobHash = match.params.jobId;
        this.setState({ isLoading: true, jobHash: jobHash });

        if (!refresh) {
            if (jobs.length > 0) {
                const jobData = jobs.filter(job => job.jobHash === jobHash);
                if (jobData[0].status.disputing) {
                    this.disputeSttInit();
                }
                this.checkPayment(jobHash);
                this.setState({ jobData: jobData[0], isLoading: false, isOwner: web3.eth.defaultAccount === jobData[0].owner });
                return;
            }
        }

        // get job status
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerJob');
        const [err, jobStatusLog] = await Utils.callMethod(jobInstance.instance.getJob)(jobHash, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            return console.log(err);
        } else {
            const jobStatus = Utils.getStatus(jobStatusLog);
            console.log(jobStatus);
            if (jobStatus.disputing) {
                this.disputeSttInit();
            }
            // get detail from ipfs
            const URl = abiConfig.getIpfsLink() + jobHash;
            const jobTpl = {
                id: jobHash,
                owner: jobStatusLog[0],
                jobHash: jobHash,
                status: jobStatus,
                bid: [],
            };
            fetch(URl)
                .then(res => res.json())
                .then(
                    result => {
                        jobTpl.title = result.title;
                        jobTpl.skills = result.skills;
                        jobTpl.description = result.description;
                        jobTpl.currency = result.currency;
                        jobTpl.budget = result.budget;
                        jobTpl.category = result.category;
                        jobTpl.estimatedTime = result.estimatedTime;
                        jobTpl.expiredTime = result.expiredTime;
                        jobTpl.created = result.created;
                        this.BidCreatedInit(jobTpl);
                    },
                    error => {
                        console.log(error);
                        this.setState({
                            stt: { err: true, text: 'Can not fetch data from server' },
                            isLoading: false,
                            jobData: null,
                        });
                    }
                );
        }
    };

    BidCreatedInit = async job => {
        const { web3 } = this.props;
        abiConfig.getPastEventsMergeBidToJob(web3, 'BBFreelancerBid', 'BidCreated', { jobHash: web3.sha3(job.jobHash) }, job, this.BidAcceptedInit);
    };

    BidAcceptedInit = async jobData => {
        const { web3 } = this.props;
        const { jobHash } = this.state;
        abiConfig.getPastEventsBidAccepted(web3, 'BBFreelancerBid', 'BidAccepted', { jobHash: jobData.jobHash }, jobData.data, this.JobsInit);
        this.checkPayment(jobHash);
    };

    JobsInit = jobData => {
        const { web3 } = this.props;
        const { jobHash } = this.state;
        if (jobData.data.status.reject) {
            abiConfig.getReasonPaymentRejected(web3, jobHash, this.getReasonPaymentRejected);
        }
        if (this.mounted) {
            this.setState({
                jobData: jobData.data,
                isOwner: web3.eth.defaultAccount === jobData.data.owner,
                isLoading: false,
            });
        }
    };

    checkPayment = async jobHash => {
        const { web3 } = this.props;
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerPayment');
        const now = Date.now();
        const [err, paymentLog] = await Utils.callMethod(jobInstance.instance.checkPayment)(jobHash, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            console.log(err);
            return;
        }
        if (paymentLog) {
            if (paymentLog[1].toString() * 1000 <= now) {
                this.setState({
                    claim: true,
                });
            }
        }
    };

    bidSwitched = open => {
        this.setState({ checkedBid: open });
    };

    back = () => {
        const { history } = this.props;
        history.goBack();
    };

    createAction = () => {
        const { history } = this.props;
        history.push('/client');
    };

    createBid = async () => {
        const { time, jobHash, award } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const awardSend = Utils.BBOToWei(web3, award);
        const instanceBid = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerBid');
        const [err, tx] = await Utils.callMethod(instanceBid.instance.createBid)(jobHash, awardSend, time, {
            from: instanceBid.defaultAccount,
            gasPrice: +instanceBid.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                bidDone: false,
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not create bid! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            bidDone: true,
            dialogLoading: false,
            actStt: {
                title: '',
                err: false,
                text: 'Your bid has been created! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    cancelBid = async () => {
        const { jobHash } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerBid');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.cancelBid)(jobHash, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                cancelBidDone: false,
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not cancel bid! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            cancelBidDone: true,
            dialogLoading: false,
            actStt: {
                err: false,
                text: 'Your bid has been canceled! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    startJob = async () => {
        const { jobHash } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerJob');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.startJob)(jobHash, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                startJobDone: false,
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not start job! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            startJobDone: true,
            dialogLoading: false,
            actStt: {
                title: '',
                err: false,
                text: 'This job has been started! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    completeJob = async () => {
        const { jobHash } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerJob');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.finishJob)(jobHash, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                completeJobDone: false,
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not complete job! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            completeJobDone: true,
            dialogLoading: false,
            actStt: {
                title: '',
                err: false,
                text: 'This job has been completed! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    claimPayment = async () => {
        const { jobHash } = this.state;
        const { web3 } = this.props;
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerPayment');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.claimePayment)(jobHash, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        this.setActionBtnDisabled(true);
        if (err) {
            this.setState({
                claimPaymentDone: false,
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Something went wrong! Can not claim payment! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            claimPaymentDone: true,
            dialogLoading: false,
            actStt: {
                title: '',
                err: false,
                text: 'You have claimed! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    confirmBid = () => {
        const { time, award } = this.state;
        const timeValid = this.validate(time, 'time');
        const awardValid = this.validate(award, 'award');
        if (timeValid && awardValid) {
            this.setActionBtnDisabled(false);
            this.setState({
                open: true,
                dialogData: {
                    actionText: 'Bid',
                    actions: this.createBid,
                },
                actStt: { title: 'Do you want to bid this job?', err: false, text: null, link: '' },
            });
        }
    };

    confirmCancelBid = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            open: true,
            dialogData: {
                actionText: 'Cancel',
                actions: this.cancelBid,
            },
            actStt: { title: 'Do you want to cancel bid this job?', err: false, text: null, link: '' },
        });
    };

    confirmStartJob = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            open: true,
            dialogData: {
                actionText: 'Start',
                actions: this.startJob,
            },
            actStt: { title: 'Do you want to start this job?', err: false, text: null, link: '' },
        });
    };

    confirmCompleteJob = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            open: true,
            dialogData: {
                actionText: 'Complete',
                actions: this.completeJob,
            },
            actStt: { title: 'Do you want to complete this job?', err: false, text: null, link: '' },
        });
    };

    confirmClaimPayment = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            open: true,
            dialogData: {
                actionText: 'Claim',
                actions: this.claimPayment,
            },
            actStt: { title: 'Do you want to claim payment this job?', err: false, text: null, link: '' },
        });
    };

    confirmFinalizeDispute = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            open: true,
            dialogData: {
                actionText: 'Finalize',
                actions: this.finalizeDispute,
            },
            actStt: { title: 'Do you want to finalize dispute for this job?', err: false, text: null, link: '' },
        });
    };

    validate = (val, field) => {
        const { jobData } = this.state;
        const avg = Utils.avgBid(jobData.bid);
        let min = 1;
        let max = jobData.estimatedTime; // need set to totaltime of job jobData.totalTime
        if (field === 'time') {
            if (val < min) {
                this.setState({ timeErr: 'Please enter your estimated time at least 1 hour' });
                return false;
            } else if (val > max) {
                this.setState({ timeErr: 'Please do not enter longer job period' });
                return false;
            }
            return true;
        } else if (field === 'award') {
            if (avg) {
                max = Number(jobData.budget.max_sum); // job budget
                min = avg / 2; // 50% of avg bid
            } else {
                max = Number(jobData.budget.max_sum); // job budget
                min = max / 10; // 10% of budget
            }
            if (val < min) {
                if (val <= 0) {
                    this.setState({ awardErr: 'Please enter your bid' });
                    return false;
                } else {
                    this.setState({
                        awardErr: 'You enter your bid too low, your bid may not be accepted by this cause',
                    });
                    return true;
                }
            } else if (val > max) {
                this.setState({ awardErr: 'Please do not enter more than job estimated budget' });
                return false;
            }
            return true;
        }
    };

    inputOnChange = (e, field) => {
        const val = Number(e.target.value);
        if (field === 'time') {
            if (!this.validate(val, 'time')) {
                return;
            }
            this.setState({ time: val, timeErr: null });
        } else if (field === 'award') {
            if (!this.validate(val, 'award')) {
                return;
            }
            this.setState({ award: val, awardErr: null });
        }
    };

    handleClose = () => {
        this.setState({ open: false, checkedBid: false });
    };

    handleCreateDisputeClose = () => {
        const { checkedDispute } = this.state;
        this.setState({ checkedDispute: !checkedDispute });
    };

    viewMyJobs = () => {
        const { history } = this.props;
        history.push('/client/manage');
    };

    handlePopoverOpen = event => {
        this.setState({ anchorEl: event.currentTarget });
    };

    handlePopoverClose = () => {
        this.setState({ anchorEl: null });
    };

    handleEvidenceShow = () => {
        const { evidenceShow } = this.state;
        this.setState({ evidenceShow: !evidenceShow });
    };

    render() {
        const {
            jobData,
            isLoading,
            stt,
            checkedBid,
            timeErr,
            awardErr,
            dialogLoading,
            open,
            actStt,
            dialogData,
            checkedDispute,
            disputeStt,
            clientRespondedDispute,
        } = this.state;
        //console.log(jobData);
        const { web3, disputeCreated } = this.props;
        let jobTplRender;

        if (stt.err) {
            jobTplRender = () => (
                <Grid container className="single-body">
                    <Grid container>
                        <h2> Sorry. {stt.text} </h2>
                    </Grid>
                </Grid>
            );
        } else {
            if (jobData) {
                jobTplRender = () => {
                    return (
                        <Grid container className="single-body">
                            <Grid container>
                                <div className="top-action">
                                    <ButtonBase onClick={this.back} className="btn btn-normal btn-default btn-back e-left">
                                        <i className="fas fa-angle-left" />
                                        Back
                                    </ButtonBase>
                                    <ButtonBase className="btn btn-normal btn-green btn-back" onClick={() => this.jobDataInit(true)}>
                                        <i className="fas fa-sync-alt" />
                                        Refresh
                                    </ButtonBase>
                                    {this.actions()}
                                </div>
                                {this.disputeActions()}
                                <Fade in={checkedBid}>
                                    <Grid container elevation={4} className={checkedBid ? 'bid-form show-block' : 'bid-form hide'}>
                                        <Grid container className="mkp-form-row">
                                            <Grid item xs={5} className="mkp-form-row-sub left">
                                                <span className="mkp-form-row-label">Time (Hour unit)</span>
                                                <span className="mkp-form-row-description">Time to complete this job</span>
                                                <input
                                                    className={timeErr ? 'input-err' : ''}
                                                    type="number"
                                                    id="time"
                                                    name="time"
                                                    min="1"
                                                    onChange={e => this.inputOnChange(e, 'time')}
                                                />
                                                {timeErr && <span className="err">{timeErr}</span>}
                                            </Grid>
                                            <Grid item xs={4} className="mkp-form-row-sub">
                                                <span className="mkp-form-row-label">Award ({jobData.currency.label})</span>
                                                <span className="mkp-form-row-description">Your bid for this job</span>
                                                <input
                                                    className={awardErr ? 'input-err' : ''}
                                                    type="number"
                                                    id="award"
                                                    name="award"
                                                    min="1"
                                                    onChange={e => this.inputOnChange(e, 'award')}
                                                />
                                                {awardErr && <span className="err">{awardErr}</span>}
                                            </Grid>
                                        </Grid>
                                        <Grid container className="mkp-form-row">
                                            <ButtonBase className="btn btn-normal btn-blue e-left" onClick={() => this.confirmBid()}>
                                                <i className="fas fa-check" /> Bid
                                            </ButtonBase>
                                            <ButtonBase className="btn btn-normal btn-red" onClick={() => this.bidSwitched(false)}>
                                                <i className="fas fa-times" />
                                                Cancel
                                            </ButtonBase>
                                        </Grid>
                                    </Grid>
                                </Fade>

                                {!disputeCreated && (
                                    <CreateDispute
                                        checkedDispute={checkedDispute}
                                        closeAct={this.handleCreateDisputeClose}
                                        jobHash={jobData.jobHash}
                                        web3={web3}
                                    />
                                )}

                                <Grid container className="job-detail-row">
                                    <Grid item xs={10}>
                                        <Grid container>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Bid</div>
                                                <div className="ct">{jobData.bid.length}</div>
                                            </Grid>
                                            {this.getMyBid()}
                                            <Grid item className="job-detail-col">
                                                <div className="name">Avg Bid ({jobData.currency.label})</div>
                                                <div className="ct">{Utils.currencyFormat(Utils.avgBid(jobData.bid))}</div>
                                            </Grid>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Job budget ({jobData.currency.label})</div>
                                                <div className="ct">{Utils.currencyFormat(jobData.budget.max_sum)}</div>
                                            </Grid>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Estimated time</div>
                                                <div className="ct">
                                                    {jobData.estimatedTime < 24
                                                        ? jobData.estimatedTime + ' H'
                                                        : Number.isInteger(jobData.estimatedTime / 24)
                                                            ? jobData.estimatedTime / 24 + ' Days'
                                                            : (jobData.estimatedTime / 24).toFixed(2) + ' Days'}
                                                </div>
                                            </Grid>
                                            {jobData.status.bidding && <Countdown name="Bid duration" expiredTime={jobData.expiredTime} />}
                                            {disputeStt.started &&
                                                (disputeStt.clientResponseDuration > 0 && (
                                                    <Countdown name="Evidence Duration" expiredTime={disputeStt.clientResponseDuration} />
                                                ))}
                                            {clientRespondedDispute.responded &&
                                                (clientRespondedDispute.commitDuration > 0 && (
                                                    <Countdown name="Voting Duration" expiredTime={clientRespondedDispute.commitDuration} />
                                                ))}
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={2}>
                                        <Grid item xs className="job-detail-col status">
                                            <div className="name">Status</div>
                                            <div className="ct">{Utils.getStatusJob(jobData.status)}</div>
                                        </Grid>
                                    </Grid>
                                </Grid>
                                <Grid container className="job-detail-description">
                                    <Grid item xs={12} className="name">
                                        Job description
                                    </Grid>
                                    <Grid item xs={12} className="ct">
                                        {jobData.description}
                                        {skillShow(jobData)}
                                    </Grid>
                                </Grid>
                                {jobData.status.bidding && (
                                    <Grid container className="freelancer-bidding">
                                        <h2>Freelancer bidding</h2>
                                        <Grid container className="list-container">
                                            <Grid container className="list-header">
                                                <Grid item xs={8}>
                                                    Bid Address
                                                </Grid>
                                                <Grid item xs={2}>
                                                    Bid Amount
                                                </Grid>
                                                <Grid item xs={2}>
                                                    Time
                                                </Grid>
                                            </Grid>
                                            {jobData.bid.length > 0 ? (
                                                <Grid container className="list-body">
                                                    {jobData.bid.map(freelancer => {
                                                        return (
                                                            <Grid key={freelancer.address} container className="list-body-row">
                                                                <Grid item xs={8} className="title">
                                                                    <span className="avatar">
                                                                        <i className="fas fa-user-circle" />
                                                                    </span>
                                                                    {freelancer.address}
                                                                    {freelancer.canceled && (
                                                                        <span className="bold">
                                                                            <span className="text-stt-unsuccess">
                                                                                &nbsp;
                                                                                <i className="fas fa-times-circle" />
                                                                                Canceled
                                                                            </span>
                                                                        </span>
                                                                    )}
                                                                </Grid>
                                                                <Grid item xs={2}>
                                                                    <span className="bold">
                                                                        {Utils.currencyFormat(freelancer.award)}
                                                                        &nbsp;
                                                                    </span>
                                                                    {jobData.currency.label}
                                                                </Grid>

                                                                <Grid item xs={2}>
                                                                    {freelancer.timeDone <= 24
                                                                        ? freelancer.timeDone + ' H'
                                                                        : Number.isInteger(freelancer.timeDone / 24)
                                                                            ? freelancer.timeDone / 24 + ' Days'
                                                                            : (freelancer.timeDone / 24).toFixed(2) + ' Days'}
                                                                </Grid>
                                                            </Grid>
                                                        );
                                                    })}
                                                </Grid>
                                            ) : (
                                                <Grid container className="no-data">
                                                    This job have no anyone bid yet
                                                </Grid>
                                            )}
                                        </Grid>
                                    </Grid>
                                )}
                            </Grid>
                        </Grid>
                    );
                };
            } else {
                jobTplRender = () => (
                    <Grid container className="single-body">
                        <Grid container>
                            <h2> Sorry. Job does not exist </h2>
                        </Grid>
                    </Grid>
                );
            }
        }
        return (
            <Grid container className="job-detail">
                <DialogPopup
                    dialogLoading={dialogLoading}
                    open={open}
                    stt={actStt}
                    actions={dialogData.actions}
                    title={actStt.title}
                    actionText={dialogData.actionText}
                    actClose={this.handleClose}
                />
                <div id="freelancer" className="container-wrp">
                    <div className="container-wrp full-top-wrp">
                        <div className="container wrapper">
                            <Grid container className="main-intro">
                                <Grid item xs={8}>
                                    {jobData && <h1>{jobData.title}</h1>}
                                </Grid>
                                <Grid item xs={4} className="main-intro-right">
                                    <ButtonBase onClick={this.createAction} className="btn btn-normal btn-white btn-create">
                                        <i className="fas fa-plus" /> Create A Job Like This
                                    </ButtonBase>
                                </Grid>
                            </Grid>
                        </div>
                    </div>
                    <div className="container-wrp main-ct">
                        <div className="container wrapper">
                            {!isLoading ? (
                                jobTplRender()
                            ) : (
                                <Grid container className="single-body">
                                    <div className="loading">
                                        <CircularProgress size={50} color="secondary" />
                                        <span>Loading...</span>
                                    </div>
                                </Grid>
                            )}
                        </div>
                    </div>
                </div>
            </Grid>
        );
    }
}

JobDetailBid.propTypes = {
    web3: PropTypes.object.isRequired,
    isConnected: PropTypes.bool.isRequired,
    match: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    jobs: PropTypes.any.isRequired,
    setActionBtnDisabled: PropTypes.func.isRequired,
    votingParams: PropTypes.object.isRequired,
    saveVotingParams: PropTypes.func.isRequired,
    disputeCreated: PropTypes.bool.isRequired,
};
const mapStateToProps = state => {
    return {
        web3: state.homeReducer.web3,
        isConnected: state.homeReducer.isConnected,
        jobs: state.clientReducer.jobs,
        setActionBtnDisabled: state.commonReducer.setActionBtnDisabled,
        votingParams: state.freelancerReducer.votingParams,
        disputeCreated: state.freelancerReducer.disputeCreated,
    };
};

const mapDispatchToProps = {
    setActionBtnDisabled,
    saveVotingParams,
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(JobDetailBid);
