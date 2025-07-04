# POR7AL
Lock Prophe7s on stake address for migration to BTC

![alt text](por7al.png)

# How it works 
In general, I was looking for a simple way to bind NFTs to an address without being able to move / spend them at all or only to a limited extent. But still have them somehow in your wallet.

To achieve this we use the fact that addresses in Cardano always consist of 3 different parts. 1. Header 2. Payment credentials 3. Delegation credentials 

┏━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃          ┃                       ┃                          ┃
┃  Header  ┃  Payment credentials  ┃  Delegation credentials  ┃
┃          ┃                       ┃                          ┃
┗━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Example address: addr_test1qrvppvp5z6ua7jx8r6n4uqslzh52wltp85gr7hpgxhw8ul2y7jnx6p3kfe0fkmupzwx8q973wymk4ux9zg0uystl8lnq3evh5e

To determine the specific User's lock address, we take his normal wallet address and extract the delegations part.

delegations part-> jnx6p3kfe0fkmupzwx8q973wymk4ux9zg0uystl8lnq

Through smart contracts, we can now create special lock address that provide the payment part of the total lock address.

This is then combined into a specific lock address

So the resulting lock address is:

addr_test1zpmqzlpknx0q2e7ukwu96u2mzl04z6n8ca3c78v5qsh5fp6y7jnx6p3kfe0fkmupzwx8q973wymk4ux9zg0uystl8lnqw00vxm

With this we have a elegant way to keep the NFT on your stake key but not make it spendable by replace the payment part with the address of the sc.

everlock.ak

-> this validator will never be spendable because we test if  #[7] equals #[0] in the query. So all NFTs locked on this paymentkey can never been spend.

Example TA: Locking on Lace Paperwallet Address on Mainnet

https://cardanoscan.io/transaction/1b16696772ea1f714b997e6d0a28b255e27a311870dfb27554f8612312026a24

The NFT is now locked for ever on this special generated lock adress but still in a utxo inside the general user wallet.


https://pool.pm/addr1qyfqzuyzjv7cpwt02sx6l5wc8w7krym8306m8r8yx45uvhvvcyar2x94c4z5dwec8zxag65ujll2axu7s57lgdlw9hdqu2kmkf

https://www.jpg.store/asset/359f7528061497ac217e556706220adbe1755f14642523ce7150dcbe303150524f50484537


