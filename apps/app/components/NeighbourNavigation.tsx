import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { NEIGHBOURS } from '../lib/neighbours';
import { useStreet } from '../lib/thread';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';

/** Founder-approved quick navigation: four avatar tiles per row. */
export function NeighbourNavigation({visible,onClose,onClearChat}:{visible:boolean;onClose:()=>void;onClearChat?:()=>void}) {
  const t=useTheme();
  const street=useStreet();
  const residents=new Set(street.data?.residents.map(row=>row.neighbour) ?? []);
  const tiles=Object.values(NEIGHBOURS).filter(n=>n.p0 && (n.id==='ollie'||residents.has(n.id)));
  const canInvite=!!street.data && Object.values(NEIGHBOURS).some(n=>n.p0 && n.id!=='ollie' && !residents.has(n.id));
  const go=(id:string)=>{
    onClose();
    if(id==='ollie')router.push('/(drawer)/board');
    else if(id==='penny'||id==='milo'||id==='mira')router.push(`/(drawer)/dashboards/${id}`);
  };
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill}/>
      <SafeAreaView edges={['bottom']} style={[styles.sheet,{backgroundColor:t.color.surfacePage,borderColor:t.color.borderStructure}]} accessibilityViewIsModal>
        <View style={styles.header}>
          <Text style={{flexShrink:1,fontFamily:t.typography.fontDisplay,fontSize:24,color:t.color.textPrimary}}>Your neighbours</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}><Icon name="close" size={24} color={t.color.textPrimary}/></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            {tiles.map(n=><View key={n.id} style={styles.cell}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${n.name} · ${n.roleWord}`} onPress={()=>go(n.id)} style={[styles.tile,{backgroundColor:t.color.surfaceCard,borderColor:t.color.borderStructure,borderBottomColor:t.color[n.domain]}]}>
                <Image source={n.head} style={styles.avatar} accessibilityIgnoresInvertColors/>
                <Text style={{fontFamily:t.typography.textBody.fontFamily,fontSize:13,color:t.color.textPrimary,textAlign:'center'}}>{n.name}</Text>
              </Pressable>
            </View>)}
          </View>
          {street.isLoading ? <ActivityIndicator color={t.color.textSecondary}/> : null}
          {street.isError ? <Pressable accessibilityRole="button" onPress={()=>void street.refetch()} style={styles.invite}><Text style={{color:t.color.interactive,fontFamily:t.typography.textBody.fontFamily}}>Try again</Text></Pressable> : null}
          {canInvite ? <Pressable accessibilityRole="button" accessibilityLabel="Invite a neighbour" onPress={()=>{onClose();router.push('/(drawer)/invite');}} style={[styles.invite,{borderColor:t.color.borderStructure}]}>
            <Icon name="add" size={20} color={t.color.interactive}/><Text style={{color:t.color.interactive,fontFamily:t.typography.textBody.fontFamily,fontSize:14}}>Invite a neighbour</Text>
          </Pressable> : null}
          {onClearChat ? <Pressable accessibilityRole="button" accessibilityLabel="Clear chat" onPress={onClearChat} style={[styles.chatAction, { borderColor: t.color.borderStructure }]}>
            <Icon name="clear_all" size={20} color={t.color.textSecondary}/>
            <Text style={{color:t.color.textPrimary,fontFamily:t.typography.textBody.fontFamily,fontSize:14}}>Clear chat</Text>
          </Pressable> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.35)'},
  sheet:{maxHeight:'75%',borderTopWidth:1},
  header:{paddingHorizontal:16,paddingTop:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  close:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  content:{padding:12,gap:12},
  grid:{flexDirection:'row',flexWrap:'wrap'},
  cell:{width:'25%',padding:4},
  tile:{borderWidth:1,borderBottomWidth:2,paddingVertical:12,paddingHorizontal:2,alignItems:'center',gap:8,minHeight:96},
  avatar:{width:40,height:40},
  chatAction:{minHeight:48,borderTopWidth:1,padding:12,flexDirection:'row',alignItems:'center',gap:8},
  invite:{minHeight:44,borderWidth:1,borderStyle:'dashed',padding:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
