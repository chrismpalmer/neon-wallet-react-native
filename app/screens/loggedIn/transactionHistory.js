import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { connect } from 'react-redux'
import { nDecimalsNoneZero } from '../../utils/walletStuff'

class TransactionHistory extends React.Component {
    static navigationOptions = ({ navigation }) => ({
        headerLeft: null
    })

    _renderRow(item) {
        const tx = item.item
        console.log(tx);
        return (
            <View style={styles.txRow}>
                <View style={styles.txId}>
                    <Text style={styles.txText}>{tx.txid.slice(0, 20)}..</Text>
                </View>
                <View style={styles.txValue}>
                    <View style={{flexDirection:'column'}}>
                        <View style={{flexDirection:'row',justifyContent:'flex-end',}}>
                            <Text style={styles.bigText}>{nDecimalsNoneZero(tx.change.NEO, 0)}</Text>
                            <Text style={styles.bigText}>NEO</Text>
                        </View>
                        <View style={{flexDirection:'row',justifyContent:'flex-end',}}>
                            <Text style={styles.bigText}>{nDecimalsNoneZero(tx.change.GAS, 8)}</Text>
                            <Text style={styles.bigText}>GAS</Text>
                        </View>
                    </View>
                </View>
            </View>
        )
    }

    _renderSeparator = () => {
        return (
            <View
                style={{
                    height: 1,
                    backgroundColor: '#CED0CE'
                }}
            />
        )
    }

    render() {
        return (
            <View>
                <FlatList
                    ItemSeparatorComponent={this._renderSeparator}
                    data={this.props.transactions}
                    renderItem={this._renderRow.bind(this)}
                    keyExtractor={item => item.txid}
                />
            </View>
        )
    }
}

const styles = StyleSheet.create({
    txRow: {
        flexDirection: 'row',
        marginHorizontal: 30,
        // height: 48
    },
    txId: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    txText: {
        fontSize: 12,
        fontWeight: '200',
    },
    txValue: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center'
    },
    bigText: {
        fontSize: 20,
        marginLeft: 5,
        fontWeight: '200',
    }
})

function mapStateToProps(state, ownProps) {
    return {
        transactions: state.wallet.transactions
    }
}

export default connect(mapStateToProps)(TransactionHistory)
