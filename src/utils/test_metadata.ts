import { fetchMintMetadata, fetchOnChainMetadata } from './metadata_util';

// Test with a well-known NFT mint address (DeGods NFT example)
const TEST_MINT = '4jrJDmB1wvY3uZY1WpQwh7JvtpVQemAnJzhi1gn3pump';

async function testMetadataFetch() {
  console.log('🧪 Testing Solana Metadata Utility...\n');
  
  try {
    console.log('📦 Testing fetchMintMetadata (with off-chain data)...');
    console.log(`Mint: ${TEST_MINT}`);
    console.log('⏳ Fetching metadata...\n');
    
    const result = await fetchMintMetadata(TEST_MINT);
    
    if (result.success && result.data) {
      console.log('✅ Success! Metadata found:');
      console.log(`📛 Name: ${result.data.name}`);
      console.log(`🏷️  Symbol: ${result.data.symbol}`);
      console.log(`🔗 URI: ${result.data.uri}`);
      console.log(`💰 Seller Fee: ${result.data.sellerFeeBasisPoints / 100}%`);
      console.log(`👥 Creators: ${result.data.creators?.length || 0}`);
      console.log(`🔄 Mutable: ${result.data.isMutable}`);
      
      if (result.data.offChainMetadata) {
        console.log('\n🌐 Off-chain metadata found:');
        console.log(`📝 Description: ${result.data.offChainMetadata.description || 'N/A'}`);
        console.log(`🖼️  Image: ${result.data.offChainMetadata.image || 'N/A'}`);
        console.log(`🏷️  Attributes: ${result.data.offChainMetadata.attributes?.length || 0}`);
      }
      
      if (result.data.collection) {
        console.log(`\n📚 Collection: ${result.data.collection.key}`);
        console.log(`✅ Verified: ${result.data.collection.verified}`);
      }
      
    } else {
      console.log('❌ Failed to fetch metadata:', result.error);
    }
    
  } catch (error) {
    console.log('💥 Error during test:', error);
  }
}

async function testOnChainOnly() {
  console.log('\n\n🚀 Testing fetchOnChainMetadata (faster, on-chain only)...');
  console.log(`Mint: ${TEST_MINT}`);
  console.log('⏳ Fetching on-chain metadata only...\n');
  
  try {
    const result = await fetchOnChainMetadata(TEST_MINT);
    
    if (result.success && result.data) {
      console.log('✅ Success! On-chain metadata:');
      console.log(`📛 Name: ${result.data.name}`);
      console.log(`🏷️  Symbol: ${result.data.symbol}`);
      console.log(`🔗 URI: ${result.data.uri}`);
      console.log('📝 Off-chain metadata: Not fetched (on-chain only mode)');
    } else {
      console.log('❌ Failed to fetch on-chain metadata:', result.error);
    }
  } catch (error) {
    console.log('💥 Error during on-chain test:', error);
  }
}

async function testInvalidMint() {
  console.log('\n\n🔍 Testing error handling with invalid mint...');
  const invalidMint = 'invalid-mint-address';
  
  try {
    const result = await fetchMintMetadata(invalidMint);
    
    if (!result.success) {
      console.log('✅ Error handling works correctly:', result.error);
    } else {
      console.log('⚠️  Expected error but got success - this is unexpected');
    }
  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

// Run all tests
async function runTests() {
  await testMetadataFetch();
  await testOnChainOnly();
  await testInvalidMint();
  
  console.log('\n🎉 Testing complete!');
  console.log('\n💡 Tips:');
  console.log('- Replace TEST_MINT with your own mint address to test different tokens');
  console.log('- Use fetchOnChainMetadata() for faster responses when you don\'t need off-chain data');
  console.log('- Use batchFetchMintMetadata() for multiple tokens at once');
}

// Execute tests
runTests().catch(console.error);